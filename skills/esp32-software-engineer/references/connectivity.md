# ESP32 Connectivity Reference

## Table of Contents
- [WiFi Management](#wifi-management)
- [Blynk Legacy Patterns](#blynk-legacy-patterns)
- [MQTT Integration](#mqtt-integration)
- [Telegram Bot Patterns](#telegram-bot-patterns)
- [OTA Strategies](#ota-strategies)
- [BLE Overview](#ble-overview)

## WiFi Management

### Robust Connection State Machine

```cpp
typedef enum {
    WIFI_DISCONNECTED,
    WIFI_CONNECTING,
    WIFI_CONNECTED,
    WIFI_CONNECTION_LOST,
    WIFI_RECONNECTING
} wifi_state_t;

static wifi_state_t g_wifi_state = WIFI_DISCONNECTED;
static unsigned long g_last_reconnect_ms = 0;
static int g_reconnect_attempts = 0;

// Call from a dedicated WiFi task or main loop
void wifi_manager_run() {
    switch (g_wifi_state) {
    case WIFI_DISCONNECTED:
        WiFi.begin(SSID, PASSWORD);
        g_wifi_state = WIFI_CONNECTING;
        g_reconnect_attempts = 0;
        break;

    case WIFI_CONNECTING:
        if (WiFi.status() == WL_CONNECTED) {
            g_wifi_state = WIFI_CONNECTED;
            ESP_LOGI("WiFi", "Connected, IP: %s", WiFi.localIP().toString().c_str());
            g_reconnect_attempts = 0;
            // Signal other subsystems via event queue
        }
        break;

    case WIFI_CONNECTED:
        if (WiFi.status() != WL_CONNECTED) {
            g_wifi_state = WIFI_CONNECTION_LOST;
            ESP_LOGW("WiFi", "Connection lost");
        }
        break;

    case WIFI_CONNECTION_LOST:
        g_wifi_state = WIFI_RECONNECTING;
        g_reconnect_attempts = 0;
        WiFi.disconnect();
        break;

    case WIFI_RECONNECTING: {
        unsigned long now = millis();
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s... cap at 60s
        unsigned long delay_ms = min(1000UL << min(g_reconnect_attempts, 6), 60000UL);
        if (now - g_last_reconnect_ms > delay_ms) {
            g_last_reconnect_ms = now;
            g_reconnect_attempts++;
            WiFi.begin(SSID, PASSWORD);
            g_wifi_state = WIFI_CONNECTING;
        }
        break;
    }
    }
}
```

### WiFi Event Handler (ESP-IDF)

```cpp
static void wifi_event_handler(void *arg, esp_event_base_t base,
                               int32_t event_id, void *data) {
    if (base == WIFI_EVENT) {
        switch (event_id) {
        case WIFI_EVENT_STA_START:
            esp_wifi_connect();
            break;
        case WIFI_EVENT_STA_DISCONNECTED: {
            wifi_event_sta_disconnected_t *evt = (wifi_event_sta_disconnected_t*)data;
            ESP_LOGW("WiFi", "Disconnected, reason: %d", evt->reason);
            // Don't reconnect here; use a timer or task with backoff
            xTaskNotifyGive(g_wifi_task_handle);
            break;
        }
        }
    } else if (base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t *evt = (ip_event_got_ip_t*)data;
        ESP_LOGI("WiFi", "Got IP: " IPSTR, IP2STR(&evt->ip_info.ip));
    }
}
```

### Common Disconnect Reasons

| Reason Code | Meaning | Fix |
|-------------|---------|-----|
| 2 | AUTH_EXPIRE | Check password |
| 3 | AUTH_LEAVE | AP deauthenticated (distance/noise) |
| 4 | ASSOC_EXPIRE | AP disassociated (inactivity) |
| 15 | 4WAY_HANDSHAKE_TIMEOUT | Wrong password |
| 200 | BEACON_TIMEOUT | AP out of range, noise floor too high |
| 201 | NO_AP_FOUND | SSID scan failed (AP power/crash) |
| 205 | AUTH_FAIL | Password rejected |

## Blynk Legacy Patterns

### Config Reference

```cpp
// Project-specific values — kept here for reference
#define BLYNK_SERVER      "43.229.135.169"
#define BLYNK_PORT        8080
#define BLYNK_VERSION     "2.27.34"

// Required library: Blynk Legacy, not Blynk 2.0/IoT
// PlatformIO: blynkkk/Blynk@^1.3.1
#include <BlynkSimpleEsp32.h>

char auth[] = "YOUR_TOKEN";
BlynkTimer timer;  // For scheduled operations

void setup() {
    WiFi.begin(SSID, PASS);
    Blynk.config(auth, BLYNK_SERVER, BLYNK_PORT);
    Blynk.connect(5000);
    timer.setInterval(1000L, sendUptime);  // Example scheduled task
}

void loop() {
    Blynk.run();
    timer.run();
}
```

### Virtual Pin Patterns

```cpp
// READ: Blynk app requests value → ESP32 responds
BLYNK_READ(V0) {
    Blynk.virtualWrite(V0, millis() / 1000);  // Uptime in seconds
}
BLYNK_READ(V1) {
    Blynk.virtualWrite(V1, readTemperature());
}

// WRITE: Blynk app sends value → ESP32 receives
BLYNK_WRITE(V2) {
    int pinValue = param.asInt();
    digitalWrite(RELAY_PIN, pinValue);
}

// WRITE with range: slider 0-1023 → PWM 0-255
BLYNK_WRITE(V3) {
    int slider = param.asInt();
    int pwmValue = map(slider, 0, 1023, 0, 255);
    ledcWrite(PWM_CHANNEL, pwmValue);
}

// Terminal widget
BLYNK_WRITE(V4) {
    String cmd = param.asStr();
    if (cmd == "status") {
        Blynk.virtualWrite(V4, "System OK, uptime: " + String(millis()/1000) + "s");
    }
}
```

### Connection Health Monitoring

```cpp
BLYNK_CONNECTED() {
    ESP_LOGI("Blynk", "Connected to server");
    Blynk.syncAll();  // Request all widget values
}

BLYNK_DISCONNECTED() {
    ESP_LOGW("Blynk", "Disconnected");
}

// Periodic health check (in BlynkTimer)
void checkConnection() {
    if (!Blynk.connected()) {
        ESP_LOGW("Blynk", "Not connected, attempting reconnect...");
        Blynk.connect(5000);
    }
}
```

### Blynk + WiFi State Sync

```cpp
// Ensure Blynk reconnects after WiFi recovery
void loop() {
    if (WiFi.status() == WL_CONNECTED) {
        if (!Blynk.connected()) {
            static unsigned long lastAttempt = 0;
            if (millis() - lastAttempt > 10000) {
                lastAttempt = millis();
                Blynk.connect(10000);
            }
        } else {
            Blynk.run();
        }
    }
}
```

## MQTT Integration

### PubSubClient Pattern

```cpp
#include <PubSubClient.h>

WiFiClient espClient;
PubSubClient mqtt(espClient);
const char *MQTT_TOPIC_CMD  = "device/cmd";
const char *MQTT_TOPIC_TELE = "device/telemetry";
const char *DEVICE_ID       = "esp32-001";

void mqttCallback(char *topic, byte *payload, unsigned int length) {
    payload[length] = 0;  // Null-terminate
    ESP_LOGI("MQTT", "Message on %s: %s", topic, (char*)payload);
}

void mqttReconnect() {
    static unsigned long lastAttempt = 0;
    if (millis() - lastAttempt < 5000) return;
    lastAttempt = millis();

    if (mqtt.connect(DEVICE_ID, MQTT_USER, MQTT_PASS)) {
        mqtt.subscribe(MQTT_TOPIC_CMD);
        ESP_LOGI("MQTT", "Connected");
    }
}

void mqttPublish(const char *json) {
    if (mqtt.connected()) {
        mqtt.publish(MQTT_TOPIC_TELE, json);
    }
}

void mqttLoop() {
    if (!mqtt.connected()) mqttReconnect();
    mqtt.loop();
}
```

### MQTT JSON Telemetry Pattern

```cpp
// Use snprintf or ArduinoJson for structured telemetry
// snprintf is lighter (no heap allocation for small payloads)
void sendTelemetry(float temp, float humidity, int rssi) {
    if (WiFi.status() != WL_CONNECTED) return;

    char payload[256];
    snprintf(payload, sizeof(payload),
        "{\"t\":%.1f,\"h\":%.1f,\"rssi\":%d,\"uptime\":%lu,\"heap\":%d}",
        temp, humidity, rssi, millis()/1000, ESP.getFreeHeap());

    mqtt.publish(MQTT_TOPIC_TELE, payload);
}
```

### MQTT QoS Guidance

| QoS | Behavior | ESP32 Use |
|-----|----------|-----------|
| 0 | Fire and forget | Telemetry (loss is acceptable) |
| 1 | At least once (ack'd) | Commands, state changes |
| 2 | Exactly once (4-step handshake) | Avoid on ESP32 — heavy, rarely needed |

## Telegram Bot Patterns

### Full Non-Blocking Implementation

```cpp
#include <WiFiClientSecure.h>
#include <UniversalTelegramBot.h>

#define BOT_TOKEN "YOUR_BOT_TOKEN"
#define CHAT_ID   "YOUR_CHAT_ID"  // For notifications

WiFiClientSecure secureClient;
UniversalTelegramBot bot(BOT_TOKEN, secureClient);
unsigned long lastBotCheck = 0;
const unsigned long BOT_POLL_MS = 2000;  // Telegram limit: ~30 polls/min per bot

void setupTelegram() {
    secureClient.setCACert(TELEGRAM_CERT);  // Root CA or setInsecure() for dev
}

void handleTelegram() {
    unsigned long now = millis();
    if (now - lastBotCheck < BOT_POLL_MS) return;
    lastBotCheck = now;

    if (WiFi.status() != WL_CONNECTED) return;

    int newMessages = bot.getUpdates(bot.last_message_received + 1);
    while (newMessages) {
        for (int i = 0; i < newMessages; i++) {
            String chat_id = bot.messages[i].chat_id;
            String text = bot.messages[i].text;

            if (text == "/status") {
                char buf[256];
                snprintf(buf, sizeof(buf),
                    "🟢 Online\nUptime: %lus\nFree heap: %d\nWiFi RSSI: %d",
                    millis()/1000, ESP.getFreeHeap(), WiFi.RSSI());
                bot.sendMessage(chat_id, buf);
            } else if (text == "/restart") {
                bot.sendMessage(chat_id, "Restarting...");
                ESP.restart();
            } else if (text.startsWith("/set ")) {
                // Parse command parameter
                String param = text.substring(5);
                bot.sendMessage(chat_id, "Set to: " + param);
            }
        }
        newMessages = bot.getUpdates(bot.last_message_received + 1);
    }
}

// Push notification helper
void telegramNotify(String message) {
    bot.sendMessage(CHAT_ID, message);
}
```

### Telegram TLS Certificate

```cpp
// Root CA for api.telegram.org (ISRG Root X1, valid until 2035)
static const char TELEGRAM_CERT[] = R"EOF(
-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
...
-----END CERTIFICATE-----
)EOF";
// Full certificate available at: https://letsencrypt.org/certs/isrgrootx1.pem
// Or use setInsecure() for development only — not for production
```

## OTA Strategies

### PlatformIO Remote OTA

```ini
; platformio.ini — OTA upload target
[env:esp32dev_ota]
platform = espressif32
board = esp32dev
framework = arduino
upload_protocol = espota
upload_port = 192.168.1.100   ; Device IP
upload_flags =
    --port=3232
    --auth=ota-password
```

### HTTP Firmware Update

```cpp
// Minimal HTTP OTA updater
#include <HTTPClient.h>
#include <Update.h>

bool updateFirmware(const char *url) {
    HTTPClient http;
    http.begin(url);
    int code = http.GET();

    if (code != 200) {
        ESP_LOGE("OTA", "HTTP error: %d", code);
        http.end();
        return false;
    }

    int contentLength = http.getSize();
    if (contentLength <= 0) {
        ESP_LOGE("OTA", "Invalid content length");
        http.end();
        return false;
    }

    if (!Update.begin(contentLength)) {
        ESP_LOGE("OTA", "Update.begin failed: %s", Update.errorString());
        http.end();
        return false;
    }

    WiFiClient *stream = http.getStreamPtr();
    size_t written = Update.writeStream(*stream);

    if (written != contentLength) {
        ESP_LOGE("OTA", "Write incomplete: %d/%d", written, contentLength);
        http.end();
        return false;
    }

    http.end();

    if (!Update.end()) {
        ESP_LOGE("OTA", "Update.end failed: %s", Update.errorString());
        return false;
    }

    if (!Update.isFinished()) {
        ESP_LOGE("OTA", "Update not finished");
        return false;
    }

    ESP_LOGI("OTA", "Update complete, restarting...");
    delay(100);
    ESP.restart();
    return true;  // Never reached
}
```

### Rollback Strategy

```cpp
// ESP-IDF has built-in rollback:
// - Mark new partition as valid only after successful boot
// - If boot fails (watchdog, panic), bootloader falls back to previous

void markFirmwareValid() {
    const esp_partition_t *running = esp_ota_get_running_partition();
    esp_ota_img_states_t state;
    if (esp_ota_get_state_partition(running, &state) == ESP_OK) {
        if (state == ESP_OTA_IMG_PENDING_VERIFY) {
            esp_ota_mark_app_valid_cancel_rollback();
            ESP_LOGI("OTA", "Firmware marked valid");
        }
    }
}
// Call markFirmwareValid() after confirmed stable (e.g., WiFi + cloud connected for 60s)
```

### OTA Partition Table (partitions_ota.csv)

```csv
# Name,   Type, SubType, Offset,  Size, Flags
nvs,      data, nvs,     0x9000,  0x5000,
otadata,  data, ota,     0xe000,  0x2000,
app0,     app,  ota_0,   0x10000, 0x300000,
app1,     app,  ota_1,   0x310000,0x300000,
spiffs,   data, spiffs,  0x610000,0x1F0000,
```

## BLE Overview

### Server (Peripheral) Pattern

```cpp
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

BLECharacteristic *pCharacteristic;

class MyCallbacks : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pChar) override {
        std::string value = pChar->getValue();
        if (!value.empty()) {
            ESP_LOGI("BLE", "Received: %s", value.c_str());
            pChar->setValue("ACK");
            pChar->notify();
        }
    }
};

void setupBLE() {
    BLEDevice::init("ESP32-Device");
    BLEServer *pServer = BLEDevice::createServer();
    BLEService *pService = pServer->createService(SERVICE_UUID);

    pCharacteristic = pService->createCharacteristic(
        CHARACTERISTIC_UUID,
        BLECharacteristic::PROPERTY_READ |
        BLECharacteristic::PROPERTY_WRITE |
        BLECharacteristic::PROPERTY_NOTIFY
    );
    pCharacteristic->setCallbacks(new MyCallbacks());
    pCharacteristic->setValue("Hello");

    pService->start();
    pServer->getAdvertising()->start();
}
```

**BLE + WiFi coexistence:** ESP32 shares the radio. WiFi takes priority. Brief BLE gaps during WiFi scans/connects are normal. Avoid continuous BLE scanning while WiFi is active — poll intermittently instead.
