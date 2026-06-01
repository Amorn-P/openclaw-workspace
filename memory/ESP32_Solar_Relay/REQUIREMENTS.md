# ESP32 Solar Relay Controller - System Requirements

## 1. Functional Requirements
- **Solar Monitoring:** Continuous measurement of solar panel output current and voltage via INA226 (I2C).
- **Automated Switching:**
  - Relay turns **ON** when Solar Current > (Threshold + Hysteresis).
  - Relay turns **OFF** when Solar Current < (Threshold - Hysteresis).
- **Blynk Integration:**
  - Remote monitoring of Current (mA), Voltage (V), and Relay State.
  - Integration with Legacy Blynk Server (43.229.135.169).
  - OTA updates for remote maintenance.
- **Fail-Safe Logic:**
  - If the INA226 sensor fails, the relay must default to **OFF** to protect the battery.
  - Logic must be **autonomous**: if WiFi/Blynk connection is lost, the local relay switching must continue to function.

## 2. Performance Requirements
- **Non-blocking Execution:** No `delay()` calls in the main loop.
- **Sampling Rate:** Sensor readings and logic checks every 1000ms.
- **Power Efficiency:** Minimize ESP32 power consumption during night mode (Current < Threshold).

## 3. Safety Requirements
- **Battery Protection:** Monitor battery voltage (via secondary sensor or INA226 bus voltage) to prevent deep discharge of the 18650 cell.
- **Reverse Current Protection:** Hardware must prevent solar-to-battery reverse flow (implemented via 1N5822 Schottky).
