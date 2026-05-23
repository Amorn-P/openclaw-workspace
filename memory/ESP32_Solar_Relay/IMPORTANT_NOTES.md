# Important Design Notes & Pitfalls

## ⚡ Electrical Design
- **Common Ground:** The ESP32, INA226, and MP1584EN must share a common ground.
- **SSR Power Consumption:** Unlike mechanical relays, the SSR-25DD requires very little current to trigger, but it *must* have a clean 5V signal via the PC817.
- **TVS Placement:** The TVS diode must be as close to the Solar Panel input terminals as possible to be effective.
- **LVC (Low Voltage Cutoff):** Ensure the TP4056 module is the "Protection" version. Without it, the ESP32 will drain the 18650 battery until it is permanently damaged.

## 💻 Software Logic
- **Autonomous Mode:** The system is designed to prioritize local solar logic over WiFi. If WiFi fails, the relay will still toggle based on the INA226 readings.
- **Hysteresis:** A 20mA hysteresis is used to prevent "cycling" during dawn/dusk or under passing clouds.
- **Sensor Fault Safety:** If the I2C bus fails or the INA226 is disconnected, the firmware is programmed to force the SSR to **OFF** immediately.

## 🛠️ Assembly
- **Heatsinking:** If the load connected to the SSR-25DD exceeds 5A, a small aluminum heatsink should be attached to the SSR.
- **Waterproofing:** Ensure cable glands are used on the IP65 box to prevent moisture ingress, which is the #1 killer of outdoor solar electronics.
