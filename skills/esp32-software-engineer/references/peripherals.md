# ESP32 Peripherals Reference

## Table of Contents
- [GPIO Patterns](#gpio-patterns)
- [I2C Bus Management](#i2c-bus-management)
- [SPI Bus Management](#spi-bus-management)
- [UART / Serial](#uart--serial)
- [RS485 & Modbus RTU](#rs485--modbus-rtu)
- [Modbus TCP](#modbus-tcp)
- [LoRa (SX127x)](#lora-sx127x)
- [ADC & Signal Conditioning](#adc--signal-conditioning)
- [PWM / LEDC](#pwm--ledc)

## GPIO Patterns

### Input with Debounce

```cpp
// Hardware-agnostic debounce
class DebouncedInput {
    uint8_t _pin;
    bool _state;
    bool _last_reading;
    unsigned long _last_change;
    const unsigned long _debounce_ms = 50;

public:
    DebouncedInput(uint8_t pin, uint8_t mode = INPUT_PULLUP)
        : _pin(pin), _state(false), _last_reading(false), _last_change(0) {
        pinMode(_pin, mode);
    }

    // Call frequently; returns true on state change
    bool update() {
        bool reading = digitalRead(_pin);
        if (reading != _last_reading) {
            _last_change = millis();
        }
        if (millis() - _last_change > _debounce_ms) {
            if (reading != _state) {
                _state = reading;
                _last_reading = reading;
                return true;
            }
        }
        _last_reading = reading;
        return false;
    }

    bool isPressed() const { return _state == LOW; }  // Assumes INPUT_PULLUP
};
```

### GPIO Pin Limits

| Constraint | Detail |
|------------|--------|
| GPIO 34-39 | Input only, no pull-up/down (ESP32) |
| GPIO 0, 2, 5, 12, 15 | Bootstrapping pins — avoid pull-down/up conflicts |
| GPIO 6-11 | Connected to internal flash (avoid on most modules) |
| Max current per GPIO | 12mA source, 40mA sink (stay under 12mA for reliability) |
| Total GPIO current | 1200mA (theoretical), 500mA practical limit |

### Interrupt-Driven Input

```cpp
// Use ISR → task notification pattern for responsive input
static volatile bool g_button_pressed = false;

void IRAM_ATTR button_isr() {
    g_button_pressed = true;  // Minimal work in ISR
}

void setup() {
    pinMode(BUTTON_PIN, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), button_isr, FALLING);
}

void loop() {
    if (g_button_pressed) {
        g_button_pressed = false;
        // Debounce + handle in task context
        delay(50);  // Simple debounce (not ideal for production — use class above)
        if (digitalRead(BUTTON_PIN) == LOW) {
            handleButtonPress();
        }
    }
}
```

## I2C Bus Management

### Bus Initialization (Custom Pins)

```cpp
#include <Wire.h>

// ESP32: any GPIO pair works for I2C
#define I2C_SDA 21
#define I2C_SCL 22
#define I2C_FREQ 100000  // 100kHz standard; 400kHz fast mode for short runs

void initI2C() {
    Wire.begin(I2C_SDA, I2C_SCL, I2C_FREQ);
    // Optional: use TwoWire(0) and TwoWire(1) for second I2C bus
}

// Bus scanner utility
void scanI2C() {
    ESP_LOGI("I2C", "Scanning...");
    uint8_t count = 0;
    for (uint8_t addr = 1; addr < 127; addr++) {
        Wire.beginTransmission(addr);
        if (Wire.endTransmission() == 0) {
            ESP_LOGI("I2C", "Device at 0x%02X", addr);
            count++;
        }
        delay(1);
    }
    ESP_LOGI("I2C", "Found %d devices", count);
}
```

### Multi-Device Bus Protocol

```cpp
// Lock the bus for atomic multi-byte transactions
SemaphoreHandle_t i2c_mutex = xSemaphoreCreateMutex();

bool readSensorAtomic(uint8_t addr, uint8_t reg, uint8_t *buf, size_t len) {
    if (xSemaphoreTake(i2c_mutex, pdMS_TO_TICKS(100)) != pdTRUE) {
        return false;
    }
    Wire.beginTransmission(addr);
    Wire.write(reg);
    if (Wire.endTransmission(false) != 0) {  // false = no stop, for repeated start
        xSemaphoreGive(i2c_mutex);
        return false;
    }
    Wire.requestFrom(addr, len);
    for (size_t i = 0; i < len && Wire.available(); i++) {
        buf[i] = Wire.read();
    }
    xSemaphoreGive(i2c_mutex);
    return true;
}
```

### Common I2C Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `endTransmission` returns 2 (NACK on addr) | Wrong address, device unpowered | Scan bus, verify wiring/power |
| `endTransmission` returns 5 (timeout) | SDA stuck low | Check pull-ups (2.2k-4.7kΩ), check for slave holding bus |
| Data reads 0xFF | Device not responding | Verify device is awake, check clock speed |
| Intermittent failures | Noise, long cables | Lower speed to 50kHz, add stronger pull-ups (1.5kΩ) |
| Multi-device corruption | Timing overlap | Use mutex as shown above |

## SPI Bus Management

### Multi-Device SPI

```cpp
#include <SPI.h>

#define SPI_MISO 19
#define SPI_MOSI 23
#define SPI_SCK  18
#define CS_SD     5   // SD card
#define CS_DISP  15   // Display
#define CS_RADIO  4   // LoRa/radio module

SPISettings sdSettings(25000000, MSBFIRST, SPI_MODE0);    // 25MHz
SPISettings dispSettings(40000000, MSBFIRST, SPI_MODE0);   // 40MHz
SPISettings radioSettings(8000000, MSBFIRST, SPI_MODE0);   // 8MHz

void initSPI() {
    SPI.begin(SPI_SCK, SPI_MISO, SPI_MOSI);

    pinMode(CS_SD, OUTPUT);    digitalWrite(CS_SD, HIGH);
    pinMode(CS_DISP, OUTPUT);  digitalWrite(CS_DISP, HIGH);
    pinMode(CS_RADIO, OUTPUT); digitalWrite(CS_RADIO, HIGH);
}

// Access pattern: beginTransaction → CS LOW → transfer → CS HIGH → endTransaction
void writeSD(uint8_t *data, size_t len) {
    SPI.beginTransaction(sdSettings);
    digitalWrite(CS_SD, LOW);
    SPI.writeBytes(data, len);
    digitalWrite(CS_SD, HIGH);
    SPI.endTransaction();
}
```

### SPI vs VSPI vs HSPI

ESP32 has up to 4 SPI controllers:
- **SPI (VSPI)**: Default `SPI` object, GPIO 5/18/19/23
- **HSPI**: Second bus, GPIO 12/13/14/15 (watch bootstrapping on GPIO 12)
- **FSPI**: ESP32-S3 only, typically for octal PSRAM

Use VSPI for displays/SD cards. Keep HSPI for secondary peripherals.

## UART / Serial

### Multiple Hardware Serials

ESP32 has 3 hardware UARTs:
- `Serial` (UART0): GPIO 1 TX, GPIO 3 RX (also used for flashing/debug)
- `Serial1` (UART1): GPIO 10 TX, GPIO 9 RX (watch flash pins)
- `Serial2` (UART2): GPIO 17 TX, GPIO 16 RX (safe for peripheral use)

```cpp
// Initialize UART2 for external device (e.g., sensor, display, RS485)
#define RS485_RX 16
#define RS485_TX 17

Serial2.begin(9600, SERIAL_8N1, RS485_RX, RS485_TX);
```

### UART Buffer Sizing

Default RX buffer is 256 bytes. For protocols with larger frames:

```cpp
// Arduino: set before begin()
Serial2.setRxBufferSize(1024);
Serial2.begin(9600, SERIAL_8N1, RS485_RX, RS485_TX);

// ESP-IDF: configure in menuconfig
// CONFIG_UART_ISR_IN_IRAM=n (keep ISR out of IRAM unless required)
// RX buffer: CONFIG_CONSOLE_UART_NUM=-1, driver/uart.h uart_driver_install()
```

### Non-Blocking Read Pattern

```cpp
// Don't use while(Serial2.available() < N) delay(1) — blocks everything

char rx_buf[256];
size_t rx_idx = 0;

// Call frequently from loop() or task
void processSerial() {
    while (Serial2.available() && rx_idx < sizeof(rx_buf) - 1) {
        char c = Serial2.read();
        rx_buf[rx_idx++] = c;

        if (c == '\n') {  // Frame delimiter
            rx_buf[rx_idx] = '\0';
            parseFrame(rx_buf);
            rx_idx = 0;
        }
    }

    // Timeout guard: discard stale partial frame
    static unsigned long last_byte = 0;
    if (rx_idx > 0 && millis() - last_byte > 100) {
        ESP_LOGW("UART", "Partial frame discarded");
        rx_idx = 0;
    }
    if (rx_idx > 0) last_byte = millis();
}
```

## RS485 & Modbus RTU

### Hardware Setup

```
ESP32                MAX485 / SP3485
TX2 (17)  ────────►  DI
RX2 (16)  ◄────────  RO
GPIO (4)  ────────►  DE + RE  (tied together)
GND       ────────   GND

                      A ──── Twisted Pair ──── A  (slave devices)
                      B ──── Twisted Pair ──── B
```

### Driver with Auto-Direction

```cpp
class RS485Bus {
    uint8_t _de_re_pin;
    HardwareSerial *_serial;

public:
    RS485Bus(HardwareSerial &serial, uint8_t de_re_pin, unsigned long baud)
        : _de_re_pin(de_re_pin), _serial(&serial) {
        pinMode(_de_re_pin, OUTPUT);
        digitalWrite(_de_re_pin, LOW);  // Receive mode default
        _serial->begin(baud);
    }

    // Send data; handles DE/RE toggle with post-transmit flush
    void transmit(const uint8_t *data, size_t len) {
        digitalWrite(_de_re_pin, HIGH);
        delayMicroseconds(50);     // Settle time (MAX485: 50µs typ)
        _serial->write(data, len);
        _serial->flush();          // Wait for TX complete
        delayMicroseconds(50);     // Hold line for last byte framing
        digitalWrite(_de_re_pin, LOW);
    }

    int available() { return _serial->available(); }
    int read() { return _serial->read(); }
};
```

### Modbus RTU Master (using emelianov/modbus-esp8266)

```ini
; platformio.ini
lib_deps =
    emelianov/modbus-esp8266@^4.1.0
```

```cpp
#include <ModbusRTU.h>

ModbusRTU mb;

bool ModbusCallback(Modbus::ResultCode event, uint16_t tid, void *data) {
    if (event == Modbus::EX_SUCCESS) {
        ESP_LOGI("Modbus", "Read success, transaction: %d", tid);
        return true;
    }
    ESP_LOGW("Modbus", "Error: 0x%02X", event);
    return true;
}

void setupModbus() {
    Serial2.begin(9600, SERIAL_8N1, 16, 17);
    mb.begin(&Serial2, DE_RE_PIN);
    mb.master();

    // Read holding registers 0-9 from slave 1
    mb.readHreg(1, 0, 10, ModbusCallback);
}

void modbusLoop() {
    mb.task();
}
```

### Modbus RTU Common Issues

| Issue | Fix |
|-------|-----|
| Timeout/no response | Check baud rate parity (9600 8N1 standard), biasing resistors (680Ω A→VCC, B→GND), 120Ω termination at both cable ends |
| CRC errors | Noise on bus — add termination, reduce baud, check cable length |
| Garbled data | DE/RE pin timing too short; increase pre/post-delay |
| Exception 0x02 (illegal address) | Register address offset (Modbus uses 0-based or 1-based depending on library) |

## Modbus TCP

### Server (Slave) Pattern

```cpp
#include <WiFi.h>
#include <ModbusTCP.h>

ModbusTCP mb;

void setupModbusTCP() {
    mb.server();
    mb.addHreg(0, 0);     // Holding register 0, initial value 0
    mb.addHreg(1, 0);     // Holding register 1
    mb.addCoil(0, false); // Coil 0
    mb.addIsts(0, false); // Input status 0
}

void updateModbusRegisters(float temp, bool relayState) {
    mb.Hreg(0, (uint16_t)(temp * 10));  // Store with 0.1°C resolution
    mb.Hreg(1, millis() / 1000);
    mb.Coil(0, relayState);
}

void loop() {
    mb.task();
    // ... other non-blocking code
}
```

### Client (Master) Pattern

```cpp
#include <ModbusIP_ESP8266.h>  // Works on ESP32 as well

ModbusIP mb;
IPAddress slaveIP(192, 168, 1, 50);

void setup() {
    WiFi.begin(SSID, PASS);
    while (WiFi.status() != WL_CONNECTED) delay(500);

    mb.client();
    mb.connect(slaveIP);  // TCP port 502 default
}

void loop() {
    static unsigned long lastPoll = 0;
    if (millis() - lastPoll > 1000) {
        lastPoll = millis();
        // Read holding registers 0-9 from slave
        if (mb.isConnected(slaveIP)) {
            mb.readHreg(slaveIP, 0, 10);
        }
    }
    mb.task();
}
```

## LoRa (SX127x)

### Hardware Configuration

```
ESP32              SX1278 (Ra-02)
3.3V      ────────  VCC
GND       ────────  GND
GPIO 18   ────────  SCK
GPIO 19   ────────  MISO
GPIO 23   ────────  MOSI
GPIO 5    ────────  NSS (CS)
GPIO 14   ────────  RST
GPIO 2    ────────  DIO0 (interrupt)
```

### LoRa Init (sandeepmistry/arduino-LoRa)

```cpp
#include <SPI.h>
#include <LoRa.h>

#define LORA_CS   5
#define LORA_RST  14
#define LORA_IRQ  2
#define LORA_FREQ 923.0  // AS923 (Thailand); use 868.0 for EU, 915.0 for US

void setupLoRa() {
    SPI.begin(18, 19, 23, LORA_CS);
    LoRa.setPins(LORA_CS, LORA_RST, LORA_IRQ);

    if (!LoRa.begin(LORA_FREQ * 1E6)) {
        ESP_LOGE("LoRa", "Init failed");
        return;
    }

    // Optimize for reliability over speed
    LoRa.setSpreadingFactor(10);      // SF7=fast to SF12=longest range
    LoRa.setSignalBandwidth(125E3);   // 125kHz (vs 250/500kHz)
    LoRa.setCodingRate4(5);           // 4/5 to 4/8 error correction
    LoRa.setTxPower(17, PA_OUTPUT_PA_BOOST_PIN);  // 17dBm max for SX1278
}

void sendLoRa(const char *msg) {
    LoRa.beginPacket();
    LoRa.print(msg);
    LoRa.endPacket();  // Blocks until TX done; use LoRa.endPacket(true) for async
}

void readLoRa() {
    int packetSize = LoRa.parsePacket();
    if (packetSize) {
        String msg;
        while (LoRa.available()) {
            msg += (char)LoRa.read();
        }
        ESP_LOGI("LoRa", "RX [%d dBm]: %s", LoRa.packetRssi(), msg.c_str());
    }
}
```

### Regional Frequency Reference

| Region | Frequency | Max TX Power | Duty Cycle |
|--------|-----------|-------------|------------|
| EU (868) | 863-870 MHz | 14 dBm | 1% (listen-before-talk) |
| US (915) | 902-928 MHz | 20 dBm | No limit (FHSS required) |
| AS923 | 920-923 MHz | 16 dBm | Country-specific |
| AU (915) | 915-928 MHz | 30 dBm | No limit |

## ADC & Signal Conditioning

### ESP32 ADC Characteristics

- 12-bit SAR ADC (0-4095), but **non-linear at extremes** (~0-200 and 3900-4095)
- **Usable range: ~100mV to ~2450mV** with 11dB attenuation
- Default attenuation 0dB (0-1.1V). Use 11dB for 0-3.3V range.
- ADC2 is shared with WiFi — avoid during WiFi active periods (use ADC1: GPIO 32-39)

```cpp
// Configure ADC for 0-3.3V range
analogSetAttenuation(ADC_11db);  // 0-3.3V range, non-linear at extremes
int raw = analogRead(35);
float voltage = (raw / 4095.0) * 3.3;

// Better: calibrated reading (ESP-IDF)
// esp_adc_cal_characteristics_t adc_chars;
// esp_adc_cal_characterize(ADC_UNIT_1, ADC_ATTEN_DB_11, ADC_WIDTH_BIT_12, 1100, &adc_chars);
```

### Voltage Divider for Higher Voltages

```
V_in (0-15V) ──┬── R1 (10kΩ) ──┬── ADC pin
               │                │
               └── R2 (3.3kΩ) ──┴── GND

V_adc = V_in * R2 / (R1 + R2) = V_in * 3.3 / 13.3 ≈ V_in * 0.248
15V → 3.72V (clamp with 3.3V zener for safety)
```

## PWM / LEDC

### LEDC (Hardware PWM)

ESP32 has 16 LEDC channels, far superior to `analogWrite()`:

```cpp
#define PWM_FREQ  5000   // 5kHz (above audible range for LED dimming)
#define PWM_RES   8      // 8-bit (0-255) or up to 16-bit
#define PWM_CH    0      // Channel 0-15
#define PWM_PIN   25

void setupPWM() {
    ledcSetup(PWM_CH, PWM_FREQ, PWM_RES);
    ledcAttachPin(PWM_PIN, PWM_CH);
}

void setDuty(uint8_t percent) {
    uint32_t duty = (percent * (1 << PWM_RES)) / 100;
    ledcWrite(PWM_CH, duty);
}

// For servo: 50Hz, 16-bit resolution
// ledcSetup(ch, 50, 16);
// ledcWrite(ch, 3277);  // 0° (0.5ms pulse)
// ledcWrite(ch, 6553);  // 180° (2.5ms pulse)
```
