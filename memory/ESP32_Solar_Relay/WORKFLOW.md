# ESP32 Solar Relay Controller - Operational Workflow

## 1. Boot Sequence
1. Initialize Serial debugging.
2. Load User Configuration (Thresholds, Pins, WiFi/Blynk creds).
3. Initialize Hardware (I2C, INA226, Relay Pin).
4. Check Sensor Health:
   - If INA226 OK: Continue.
   - If INA226 Fail: Enter **Safe Mode** (Relay OFF, log error).
5. Initialize WiFi/Blynk (Non-blocking):
   - Do NOT wait for connection; proceed to main loop immediately.

## 2. Main Execution Loop (Non-blocking)
1. **Sensor Task (Every 1000ms):**
   - Read Current (mA) from INA226.
   - Read Bus Voltage (V) from INA226.
   - Apply temperature compensation (if sensor available).
2. **Logic Task:**
   - Compare readings against `CURRENT_THRESHOLD` + `HYSTERESIS`.
   - Update `relayState`.
   - Toggle GPIO Pin.
3. **Communication Task:**
   - `Blynk.run()` to handle heartbeat and incoming commands.
   - Every 5 seconds: Push data to Blynk Virtual Pins (V0, V1, V2).
4. **Maintenance Task:**
   - Handle OTA updates if requested.
   - Check WiFi status and attempt reconnect if dropped (without blocking logic).

## 3. State Transitions
- **IDLE/NIGHT:** Solar Current is low. Relay is OFF. ESP32 monitors for sunrise.
- **ACTIVE/DAY:** Solar Current exceeds threshold. Relay is ON. Load is powered.
- **FAULT:** Sensor failure detected. Relay forced OFF.
