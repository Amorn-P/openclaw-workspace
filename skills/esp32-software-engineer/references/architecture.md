# ESP32 Architecture & Stability Reference

## Table of Contents
- [FreeRTOS Task Design](#freertos-task-design)
- [Memory Management](#memory-management)
- [Watchdog Configuration](#watchdog-configuration)
- [Crash Analysis](#crash-analysis)
- [Component Boundaries](#component-boundaries)
- [Power Management](#power-management)

## FreeRTOS Task Design

### Task Count & Rationale

ESP32 runs on two cores (PRO_CPU=0, APP_CPU=1). The system already uses:
- `IDLE` x2 (one per core)
- `esp_timer` (high priority)
- `ipc` tasks (inter-core communication)
- `wifi` stack task
- `main` task (runs `app_main`, can delete itself after init)

**Rule of thumb:** Stay under 10 total persistent tasks. If crossing 8, audit for merge opportunities.

### Pinning vs Floating

```cpp
// Pin to core when:
// - Task must run alongside WiFi (pin to core 0; WiFi runs on core 0)
// - Hard real-time constraints (dedicated core avoids cache misses)
// - Peripheral ISR affinity matters
xTaskCreatePinnedToCore(taskFn, "name", stack, NULL, prio, &handle, 1);

// Float when:
// - General-purpose work; FreeRTOS load-balances automatically via tickless idle
// - Task does not need to coexist with specific interrupt routines
xTaskCreate(taskFn, "name", stack, NULL, prio, &handle);
```

### Stack Sizing

Always measure, never guess:

```cpp
// At end of task function or periodic log:
UBaseType_t highWater = uxTaskGetStackHighWaterMark(NULL);
ESP_LOGI("STACK", "%s high water: %u words", pcTaskGetName(NULL), highWater);

// Safety margin
// Start 2x measured high-water, then reduce to 1.3x after soak testing
// Watch for intermittent spikes under WiFi reconnect + protocol burst
```

**Typical baselines** (words, Arduino framework, single core):
| Subsystem | Start Stack | Typical Settled |
|-----------|-------------|-----------------|
| WiFi manager | 8192 | 4096 |
| Blynk protocol | 8192 | 4096 |
| Modbus RTU | 4096 | 2048 |
| Sensor poller | 4096 | 2048 |
| Telegram bot | 10240 | 6144 |
| OTA handler | 8192 | 4096 |
| Display/UI | 6144 | 4096 |

ESP-IDF stacks are typically smaller (IDF WiFi stack is separate from app task).

### Avoiding Priority Inversion

```cpp
// WRONG: Low-prio task holds mutex, high-prio task starves
SemaphoreHandle_t mutex = xSemaphoreCreateMutex();

// CORRECT: Use mutex (not binary semaphore) — FreeRTOS applies priority inheritance
// Mutex automatically boosts the holder to the waiter's priority
xSemaphoreTake(mutex, pdMS_TO_TICKS(100));  // Always with timeout
// ... critical section ...
xSemaphoreGive(mutex);
```

**Never use a binary semaphore for mutual exclusion** — no priority inheritance.

### Notification Over Queue Where Possible

Task notifications are ~45% faster and use no heap:

```cpp
// SENDER: Notify one task (no data, just signal)
xTaskNotifyGive(targetTaskHandle);

// RECEIVER: Wait for notification
ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(1000));

// SENDER: Notify with 32-bit value (fast value passing)
xTaskNotify(targetTaskHandle, (1 << 5), eSetBits);

// RECEIVER: Wait for specific bits
uint32_t bits;
xTaskNotifyWait(0, ULONG_MAX, &bits, pdMS_TO_TICKS(500));
if (bits & (1 << 5)) { /* handle */ }
```

Limit: One notification per task. Use queues when one task signals multiple receivers.

## Memory Management

### Heap Regions

ESP32 has multiple heaps:
- **DRAM** (internal SRAM): `malloc`/`new` default. ~300KB on standard ESP32.
- **PSRAM** (external SPI RAM): 2MB/4MB/8MB. Slower, must enable in menuconfig.
- **IRAM**: Instruction RAM, cache-backed. Function code. Don't allocate here.

```cpp
// Force allocation to PSRAM
void *buf = heap_caps_malloc(1024 * 100, MALLOC_CAP_SPIRAM);

// Check what's available
ESP_LOGI("MEM", "DRAM free: %d", heap_caps_get_free_size(MALLOC_CAP_8BIT));
ESP_LOGI("MEM", "PSRAM free: %d", heap_caps_get_free_size(MALLOC_CAP_SPIRAM));
```

### PSRAM Usage

```ini
; platformio.ini flags for PSRAM on ESP32
build_flags =
    -DBOARD_HAS_PSRAM
    -mfix-esp32-psram-cache-issue
```

```cpp
// In Arduino, enable PSRAM before any allocation:
// Tools > PSRAM: "Enabled" in Arduino IDE
// Or in platformio.ini:
// board_build.arduino.memory_type = qio_opi

// Verify at runtime:
if (psramFound()) {
    ESP_LOGI("PSRAM", "Size: %d bytes", ESP.getPsramSize());
}
```

### Avoiding Heap Fragmentation

1. **Prefer static allocation** for fixed-size objects:
   ```cpp
   StaticQueue_t queue_buffer;
   uint8_t queue_storage[32 * sizeof(MyStruct)];
   QueueHandle_t queue = xQueueCreateStatic(32, sizeof(MyStruct), queue_storage, &queue_buffer);
   ```

2. **Pool long-lived allocations at boot**, never in loops:
   ```cpp
   // Good: allocate once
   static char *json_buf = (char*)malloc(4096);  // Once at startup

   // Bad: allocate per iteration
   void loop() {
       char *json_buf = (char*)malloc(4096);  // Fragments heap over time
       free(json_buf);
   }
   ```

3. **Use `calloc`** for zero-init (avoids uninitialized-memory bugs).

4. **Watch for WiFi/BLE stack allocations** — they can spike to 50KB+ during connection. Leave headroom.

### Memory Map Quick Reference

| Region | ESP32 | ESP32-S3 | Notes |
|--------|-------|----------|-------|
| DRAM | 320KB | 512KB | Internal SRAM, fast |
| PSRAM | 0-8MB | 0-8MB | External, slower |
| IRAM | 128KB | 128KB | Cache for flash code |
| RTC FAST | 8KB | 8KB | Survives deep sleep |
| RTC SLOW | 8KB | 8KB | Survives deep sleep |

## Watchdog Configuration

### Task Watchdog (TWDT)

```cpp
#include <esp_task_wdt.h>

// In task init (run once):
esp_task_wdt_add(NULL);  // NULL = current task

// In task loop (must be called within timeout):
esp_task_wdt_reset();

// On task delete:
esp_task_wdt_delete(NULL);

// Default timeout: 5 seconds (configurable in menuconfig)
// Feed at 2-3x frequency: every 2s for a 5s timeout
```

### Interrupt Watchdog (IWDT)

Configure via menuconfig; triggers on ISR that runs > ~300ms. Don't do heavy work in ISRs.

### Watchdog Reset Pattern for Critical Sections

```cpp
// Long flash write or sensor calibration that can legitimately take time:
esp_task_wdt_delete(NULL);  // Unsubscribe
flash_erase_write_large_block();
esp_task_wdt_add(NULL);     // Re-subscribe
```

### Boot Loop Protection

ESP32 bootloader tracks reset reason. Use this to detect watchdog loops:

```cpp
void setup() {
    esp_reset_reason_t reason = esp_reset_reason();
    if (reason == ESP_RST_PANIC || reason == ESP_RST_TASK_WDT) {
        ESP_LOGE("BOOT", "Watchdog reset detected, entering safe mode");
        // Skip risky init, load minimal config, signal error
        safeModeInit();
    } else {
        normalInit();
    }
}
```

## Crash Analysis

### Decoding Backtrace with PlatformIO

```bash
# 1. Capture backtrace from serial:
# Backtrace: 0x40082d9d:0x3ffb2170 0x40083aad:0x3ffb2190 ...

# 2. Decode with xtensa addr2line:
~/.platformio/packages/toolchain-xtensa-esp32/bin/xtensa-esp32-elf-addr2line \
    -pfiaC -e .pio/build/esp32dev/firmware.elf 0x40082d9d 0x40083aad
```

### Common Crash Patterns

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `LoadProhibited` | NULL pointer deref, or accessing freed memory | Audit pointer lifetimes |
| `StoreProhibited` | Writing to read-only memory (flash, ROM) | Check const-correctness |
| `IntegerDivideByZero` | Division by zero | Guard divisions |
| `IllegalInstruction` | Corrupted stack, jumping to data | Check stack sizing |
| `Guru Meditation: Cache disabled` | ISR accessing flash without IRAM_ATTR | Add `IRAM_ATTR` to ISR |
| `Guru Meditation: Interrupt wdt timeout` | ISR doing heavy work or blocking | Move work to task, ISR only signal |
| `Brownout detector triggered` | Power supply sag on WiFi/BLE TX | Add bulk capacitor, better PSU |

### Core Dump to Flash

```ini
# platformio.ini - store core dump in flash partition
board_build.partitions = partitions_with_coredump.csv
build_flags =
    -DCONFIG_ESP32_ENABLE_COREDUMP_TO_FLASH=y
```

```bash
# Retrieve and decode:
pio run -t core-dump-info
```

## Component Boundaries

### Interface Contract Pattern

Each subsystem exposes exactly one public header:

```cpp
// sensor_bme280.h — public interface
// Only this header is #included by other modules
#pragma once
#include <stdint.h>
#include <stdbool.h>

typedef struct {
    float temperature;
    float humidity;
    float pressure;
} bme280_reading_t;

bool bme280_init(uint8_t i2c_addr);
bool bme280_read(bme280_reading_t *out);
void bme280_sleep(void);
```

```cpp
// sensor_bme280.cpp — private implementation
// Internal helpers, static variables, I2C transactions
// No other module includes this file
```

### Dependency Rule

```
main.cpp → wifi_manager.h → protocol_handler.h
                              ↓
                          sensor_task.h
                              ↓
                          storage.h
```

Arrows show `#include` direction. Circular includes are a build error.

### Init Sequence

```cpp
void app_main() {
    // 1. Hardware init (no dependencies)
    init_nvs();
    init_gpio();
    init_serial(115200);

    // 2. Drivers (depend on hardware)
    init_i2c_bus();
    init_spi_bus();
    init_rs485(SERIAL2, RX2, TX2, DE_RE_PIN);

    // 3. Subsystems (depend on drivers)
    ESP_ERROR_CHECK(wifi_manager_init());
    sensor_manager_init();
    storage_init();

    // 4. Protocol layer (depends on WiFi + subsystems)
    protocol_handler_init();

    // 5. OTA (depends on WiFi)
    ota_init();

    // 6. Delete self to free stack (optional)
    vTaskDelete(NULL);
}
```

## Power Management

### Light Sleep with WiFi

```cpp
// ESP32 can maintain WiFi association during light sleep
// with DTIM beacon skipping
esp_wifi_set_ps(WIFI_PS_MAX_MODEM);  // Maximum power save
// WiFi stack wakes on DTIM beacons, keeps connection alive

// For sensor-only devices:
// Deeper patterns in reference material
// Use ULP coprocessor for wake-on-sensor triggers
```

### Typical Power Numbers (ESP32-WROOM-32E, 3.3V)

| Mode | Current | Use Case |
|------|---------|----------|
| Active (WiFi TX) | 160-260mA | Data upload |
| Active (WiFi RX) | 95-100mA | Listening |
| Active (CPU only) | 30-50mA | Local processing |
| Modem sleep | 3-20mA | Idle, WiFi associated |
| Light sleep | 0.8mA | Periodic wake |
| Deep sleep | 5-10µA | Battery powered, wake on timer/GPIO |
