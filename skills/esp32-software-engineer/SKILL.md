---
name: esp32-software-engineer
description: "ESP32 firmware engineering across ESP-IDF and Arduino frameworks. Use when designing, implementing, debugging, or reviewing ESP32 firmware—including FreeRTOS task architectures, peripheral drivers (GPIO/SPI/I2C/UART/RS485), wireless stacks (WiFi/BLE/LoRa), protocol integrations (Modbus RTU/TCP, MQTT, Blynk Legacy, Telegram bots), OTA update pipelines, memory/PSRAM optimization, watchdog configuration, and crash-dump analysis. Also use for PlatformIO project structure, build-system tuning, and production-hardening reviews."
---

# ESP32 Software Engineer

## Quick Reference

| Need | Read |
|------|------|
| Task layout, memory, component design, stability | [references/architecture.md](references/architecture.md) |
| WiFi, Blynk, OTA, Telegram, MQTT, BLE | [references/connectivity.md](references/connectivity.md) |
| GPIO, SPI, I2C, UART, RS485, Modbus, LoRa | [references/peripherals.md](references/peripherals.md) |

## Core Principles

### Before Writing Any Code

1. **Confirm the framework** — ESP-IDF (CMake, component model) vs Arduino (single `.ino` or PlatformIO). Do not mix framework idioms in the same module.
2. **Check the target chip** — ESP32, ESP32-S2, ESP32-S3, ESP32-C3. Peripheral availability, PSRAM, and pin mux differ.
3. **Map the hardware** — Get the schematic or pin assignment *before* writing drivers. Guessing pins causes silent failures.
4. **Plan task boundaries** — Every subsystem (WiFi, sensors, HMI, protocol) gets its own file. Single `main.cpp` with everything is a review blocker.

### Code Quality Baseline

- Every public function in a `.h` file gets a Doxygen comment.
- `configASSERT` on every `xQueueSend`/`xSemaphoreTake`/`xTaskCreate` return value in production paths.
- `static` on all file-local functions and variables.
- `const` on all pointer parameters that are read-only.
- No `delay()` in ESP-IDF code; use `vTaskDelay` or event-driven patterns.
- No `String` class in ESP-IDF; use `std::string` (heap) or fixed `char[]` buffers.
- Logging: `ESP_LOGE` for errors, `ESP_LOGW` for warnings, `ESP_LOGI` for state transitions, `ESP_LOGD`/`ESP_LOGV` for debug. Strip verbose logs from production builds via menuconfig.

## Architecture Patterns

### Component Structure (ESP-IDF)

```
main/
├── CMakeLists.txt        # idf_component_register(SRCS ... REQUIRES ...)
├── main.cpp              # app_main(), init sequence, no business logic
├── config.h              # Pin definitions, constants, feature flags
├── wifi_manager.h/cpp    # WiFi connect/reconnect, event handler
├── protocol_handler.h/cpp # Blynk/Modbus/MQTT glue
├── sensor_task.h/cpp     # One file per sensor family or bus
├── storage.h/cpp         # NVS / SPIFFS / LittleFS wrappers
└── ota.h/cpp             # OTA update logic
```

### PlatformIO Project Structure (Arduino Framework)

```
project/
├── platformio.ini
├── src/
│   ├── main.cpp
│   ├── config.h
│   ├── wifi_manager.h/cpp
│   ├── ...
└── lib/                  # Private libraries (one per subsystem)
    ├── SensorDriver/
    │   ├── library.json
    │   └── src/...
    └── ProtocolBridge/
        └── src/...
```

### Task Layout Pattern

Maximum 5-6 persistent tasks. Everything else is event-driven or one-shot.

```cpp
// Priority allocation (lower number = lower priority in FreeRTOS)
// ESP-IDF: 0 (idle) to 25 (highest); Arduino: 0 to configMAX_PRIORITIES-1
enum TaskPriority {
    PRIO_BACKGROUND  = 1,   // Logging, stats, NVS writes
    PRIO_SENSOR      = 2,   // Sensor polling
    PRIO_PROTOCOL    = 3,   // Blynk/Modbus/MQTT processing
    PRIO_WIFI        = 4,   // WiFi event handling
    PRIO_CRITICAL    = 5    // Emergency shutdown, watchdog feeder
};

// Stack sizing heuristic (words, not bytes)
// ESP32: 1 word = 4 bytes on 32-bit, 4 bytes on most configs
// Start with measured uxTaskGetStackHighWaterMark + 50% headroom
```

### Event Bus Over Global Variables

Prefer a single event queue for inter-task communication instead of scattered globals:

```cpp
enum EventType { EVT_WIFI_CONNECTED, EVT_WIFI_LOST, EVT_SENSOR_READING, EVT_PROTOCOL_CMD };

struct SystemEvent {
    EventType type;
    union {
        struct { float temp; float humidity; } sensor;
        struct { uint8_t pin; uint8_t value; } command;
    } data;
};

// One queue, multiple consumers via event type filtering
QueueHandle_t g_event_queue;  // Created in app_main, passed to tasks
```

## Build Config (platformio.ini baseline)

```ini
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
monitor_speed = 115200

; PSRAM enabled for ESP32 with PSRAM variants
board_build.flash_mode = dio
board_build.partitions = default_16MB.csv

; OTA requires at least 2 app partitions + factory
; Use min_spiffs.csv or custom partition table for production

; Performance
build_flags =
    -DCORE_DEBUG_LEVEL=0
    -DCONFIG_ARDUINO_LOOP_STACK_SIZE=8192

; Libraries
lib_deps =
    blynkkk/Blynk @ ^1.3.1         ; Blynk Legacy (official)
    knolleary/PubSubClient @ ^2.8   ; MQTT
    bodmer/TFT_eSPI @ ^2.5          ; Display
```

## Development Workflow

### New Feature Pipeline

1. **Define the interface** — Header file with documented API, no implementation yet. Get the contract right first.
2. **Stub + test** — Minimal implementation behind the interface. Verify compilation and linking.
3. **Integrate** — Wire into the event bus or task. Test on hardware with serial logs.
4. **Harden** — Add timeouts, error recovery, watchdog feeding, memory guards.
5. **Test** — Run unit and integration tests (see below). Tests must pass before `.bin` generation.
6. **Review** — Check against the code quality baseline above.

### Testing Gate — Must Pass Before Compile to .bin

No `.bin` leaves the machine without tests passing. This is a hard gate.

```bash
# PlatformIO test runner (native or on-device)
pio test -e native       # Desktop-native tests (fast, no hardware needed)
pio test -e esp32dev     # On-device tests (hardware-in-the-loop)

# Build gate — abort on test failure
pio test -e native && pio run -e esp32dev || (echo "TESTS FAILED — .bin NOT generated" && exit 1)
```

#### Test Structure (PlatformIO)

```
test/
├── test_native/           # Desktop-only tests (no hardware)
│   ├── test_math.cpp      # Pure logic, protocol parsing, state machines
│   └── test_messages.cpp  # Serialization/deserialization
├── test_esp32dev/         # On-device tests (requires hardware)
│   ├── test_gpio.cpp      # Pin toggling, interrupts
│   ├── test_i2c.cpp       # Bus scan, sensor reads
│   └── test_wifi.cpp      # Connection, reconnection
└── README.md              # Test suite documentation
```

#### Minimal Unit Test Pattern (Unity + PlatformIO)

```cpp
// test/test_native/test_protocol_parser.cpp
#include <unity.h>
#include "protocol_parser.h"

void test_parse_valid_frame() {
    uint8_t frame[] = {0x01, 0x03, 0x00, 0x05, 0x00, 0x02, 0x94, 0x0B};
    parsed_frame_t result;
    TEST_ASSERT_TRUE(parse_modbus_frame(frame, sizeof(frame), &result));
    TEST_ASSERT_EQUAL(0x01, result.slave_id);
    TEST_ASSERT_EQUAL(0x03, result.function_code);
}

void test_parse_crc_error() {
    uint8_t frame[] = {0x01, 0x03, 0x00, 0x05, 0x00, 0x02, 0xFF, 0xFF};
    parsed_frame_t result;
    TEST_ASSERT_FALSE(parse_modbus_frame(frame, sizeof(frame), &result));
}

void setup() {
    UNITY_BEGIN();
    RUN_TEST(test_parse_valid_frame);
    RUN_TEST(test_parse_crc_error);
    UNITY_END();
}

void loop() {}  // Not used in native tests
```

#### Hardware-in-the-Loop (HIL) Pattern

```cpp
// test/test_esp32dev/test_i2c_bus.cpp
#include <unity.h>
#include <Wire.h>

void test_i2c_bus_present() {
    Wire.begin(I2C_SDA, I2C_SCL);
    Wire.beginTransmission(0x76);  // BME280 default address
    uint8_t error = Wire.endTransmission();
    TEST_ASSERT_EQUAL_MESSAGE(0, error, "BME280 not found on I2C bus");
}

void test_i2c_read_register() {
    Wire.beginTransmission(0x76);
    Wire.write(0xD0);  // WHO_AM_I register
    Wire.endTransmission(false);
    Wire.requestFrom(0x76, (uint8_t)1);
    TEST_ASSERT_TRUE(Wire.available());
    uint8_t chip_id = Wire.read();
    TEST_ASSERT_EQUAL(0x60, chip_id);  // BME280 chip ID
}

void setup() {
    delay(2000);  // Allow serial to settle
    UNITY_BEGIN();
    RUN_TEST(test_i2c_bus_present);
    RUN_TEST(test_i2c_read_register);
    UNITY_END();
}

void loop() {}
```

#### platformio.ini Test Environment

```ini
; Native test environment (no hardware, runs on dev machine)
[env:native]
platform = native
test_framework = unity

; On-device test environment
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
test_framework = unity
test_ignore = test_native      ; Skip native tests on hardware

; Production build environment
[env:esp32dev_release]
platform = espressif32
board = esp32dev
framework = arduino
build_flags =
    -DRELEASE_BUILD
    -DCORE_DEBUG_LEVEL=0
```

#### CI Build Script (test-gate.sh / test-gate.ps1)

```powershell
# test-gate.ps1 — Gate: tests must pass before .bin is generated
$ErrorActionPreference = "Stop"

Write-Host "=== Running native tests ===" -ForegroundColor Cyan
pio test -e native
if ($LASTEXITCODE -ne 0) {
    Write-Host "NATIVE TESTS FAILED — aborting build" -ForegroundColor Red
    exit 1
}

Write-Host "=== Running on-device tests ===" -ForegroundColor Cyan
pio test -e esp32dev
if ($LASTEXITCODE -ne 0) {
    Write-Host "DEVICE TESTS FAILED — aborting build" -ForegroundColor Red
    exit 1
}

Write-Host "=== All tests passed — building release .bin ===" -ForegroundColor Green
pio run -e esp32dev_release
Write-Host "Build successful: .pio/build/esp32dev_release/firmware.bin" -ForegroundColor Green
```

#### What Gets Tested Where

| Test Type | Environment | Examples |
|-----------|------------|----------|
| Pure logic | `native` | Protocol parsing, state machines, math, CRC calc, JSON serialization |
| Mocked hardware | `native` | Driver logic with mock I2C/SPI, simulated sensor data |
| Bus scan | `esp32dev` | I2C device presence, SPI loopback, UART echo |
| Peripheral read | `esp32dev` | Known sensor register readback, GPIO pin state |
| Integration | `esp32dev` | WiFi connect → cloud ping, Modbus read round-trip, OTA checksum |
| Stress | `esp32dev` | 1000x reconnect loop, 24h heap monitoring, burst message handling |

> For comprehensive testing strategy including mocks, CI integration, and TDD workflow, see the companion skill: **esp32-platformio-testing**.

### Debugging Quick-Start

```
# Serial monitor with timestamps
pio device monitor --filter=time

# Core dump analysis (ESP-IDF)
espcoredump.py info_corefile -t b64 -c core.dump build/firmware.elf

# Stack high-water marks
ESP_LOGI("TAG", "Stack free: %d", uxTaskGetStackHighWaterMark(NULL));

# Free heap
ESP_LOGI("TAG", "Free heap: %d", esp_get_free_heap_size());
```

### Production Hardening Checklist

- [ ] All `xQueueSend`/`xSemaphoreTake` calls have timeouts, not `portMAX_DELAY`
- [ ] Watchdog configured for all persistent tasks (`esp_task_wdt_add`)
- [ ] WiFi reconnect backoff (exponential, max ~60s)
- [ ] NVS wear-leveling considered for frequently-written keys
- [ ] OTA rollback on boot failure (ESP-IDF: `esp_https_ota` with `esp_ota_set_boot_partition`)
- [ ] Brownout detector enabled (`CONFIG_ESP32_BROWNOUT_DET`)
- [ ] Heap corruption check enabled in debug builds (`CONFIG_HEAP_POISONING_COMPREHENSIVE`)
- [ ] No blocking operations in the Arduino `loop()` or high-priority tasks
- [ ] Sensor readings batched, not sent one-by-one to cloud

## Blynk Legacy Integration (Project-Specific)

This skill's current project uses **Blynk Legacy v2.27.34** against server **43.229.135.169**.

```cpp
// Essential Blynk Legacy setup
#define BLYNK_PRINT Serial
#include <BlynkSimpleEsp32.h>

char auth[] = "YOUR_AUTH_TOKEN";
char server[] = "43.229.135.169";
uint16_t port = 8080;  // Legacy default, adjust if different

// In setup():
Blynk.config(auth, server, port);
Blynk.connect(5000);  // 5s timeout, non-blocking

// In loop():
Blynk.run();

// Reconnect timer pattern (avoid blocking Blynk.run())
unsigned long lastReconnectAttempt = 0;
void checkBlynkConnection() {
    if (!Blynk.connected()) {
        unsigned long now = millis();
        if (now - lastReconnectAttempt > 10000) {
            lastReconnectAttempt = now;
            Blynk.connect(5000);
        }
    }
}
```

**Common Blynk Legacy gotchas:**
- Virtual pin writes to unconfigured pins are silently dropped.
- `Blynk.run()` must be called frequently; long `delay()` calls cause disconnects.
- Auth token rotation requires reflashing unless stored in NVS with fallback.
- Legacy server expects specific heartbeat timing; check `BLYNK_HEARTBEAT` define.

## Telegram Bot Integration

```cpp
// Pattern: Non-blocking HTTP(S) poll with WiFi-aware guard
#include <WiFiClientSecure.h>
#include <UniversalTelegramBot.h>

WiFiClientSecure secured_client;
UniversalTelegramBot bot(BOT_TOKEN, secured_client);

void telegramTask(void *pvParams) {
    const int POLL_MS = 2000;
    for (;;) {
        if (WiFi.status() == WL_CONNECTED) {
            int updates = bot.getUpdates(bot.last_message_received + 1);
            for (int i = 0; i < updates; i++) {
                telegram_bot::Message msg = bot.messages[i];
                // Handle commands...
            }
        }
        vTaskDelay(pdMS_TO_TICKS(POLL_MS));
    }
}
```

**Gotchas:**
- `WiFiClientSecure` needs `setCACert()` or `setInsecure()` for TLS. Prefer root CA for production.
- Long messages (>4096 chars) must be split across multiple `bot.sendMessage()` calls.
- Rate limit: ~30 messages/second per chat, ~1 message/second per group (Telegram API limit).

## OTA Update Patterns

### PlatformIO OTA (Arduino Framework)

```cpp
#include <ArduinoOTA.h>

void setupOTA() {
    ArduinoOTA.setHostname("esp32-device-1");
    ArduinoOTA.setPassword("ota-password");  // Optional but recommended

    ArduinoOTA.onStart([]() {
        ESP_LOGI("OTA", "Update starting");
        // Detach all peripherals, stop motor/sensor tasks
    });
    ArduinoOTA.onError([](ota_error_t error) {
        ESP_LOGE("OTA", "Error[%u]", error);
        ESP.restart();
    });

    ArduinoOTA.begin();
}

// In loop():
ArduinoOTA.handle();
```

### ESP-IDF Native OTA

```cpp
esp_http_client_config_t config = {
    .url = "https://ota.example.com/firmware.bin",
    .cert_pem = server_cert_pem_start,
    .timeout_ms = 5000,
};
esp_https_ota_config_t ota_config = {
    .http_config = &config,
};
esp_err_t ret = esp_https_ota(&ota_config);
if (ret == ESP_OK) {
    esp_restart();
}
```

## When to Read Reference Files

- **references/architecture.md** — Before designing a new subsystem's task layout, when running into stack overflows or heap fragmentation, when adding a new major feature, or when doing a stability review.
- **references/connectivity.md** — When adding/changing WiFi handling, implementing Blynk/Telegram/MQTT, setting up OTA for the first time, or debugging persistent disconnection issues.
- **references/peripherals.md** — When writing a new sensor or actuator driver, integrating RS485/Modbus/LoRa, or debugging hardware communication failures.
