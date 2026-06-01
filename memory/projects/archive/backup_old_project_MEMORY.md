# MEMORY.md - Long-Term Project Memory

## ESP32 Software Projects

### Project Context
- **User:** Papa
- **Assistant:** Sherry (Partner & Coworker)
- **Primary Goal:** Develop and maintain two distinct, modular, and stable ESP32-based water pump control systems:
  1. **Legacy System:** Blynk Legacy + Telegram for master control of 5 RS485 relay boards.
  2. **IoT System:** Blynk IoT + Telegram for a LoRa network (1 master + 8 autonomous slaves that report status).

### Skills
  - Skills for `ESP32 Software Engineer` and `ESP32 PlatformIO Testing` created and ready for use.

### Major Milestones
- **Legacy System:**
  - Initial Git repository setup and Phase 1 Refactoring (RS485/Blynk) completed.
  - Modularization of web configuration and system logic.
  - Connectivity Milestone achieved with local Blynk server (43.229.135.169).
  - **Auto Pump Review (March 2026):** Completed deep-dive review of `E:\Arduino\Auto_Pump_07_03_2569`.
- **IoT System:**
  - Phase 2 (LoRa) conceptualized with design for 1 master + 8 autonomous slaves.

### Key Decisions & Architecture
- **Modular Design:** Using `.h`/`.cpp` files for hardware, logic, and networking instead of legacy header-only files.
- **Blynk Singleton:** Handled via `NO_GLOBAL_BLYNK` macro in modular files to prevent linker collisions while maintaining access to the `Blynk` object.
- **Preferences API:** Used for non-volatile storage of system state (CountP1Min) to ensure continuity after watchdogs or power cycles.
- **Mutexes:** Implemented `preferencesMutex` and `blynkMutex` for thread-safe multi-core access.
- **Scalability:** Recommended moving from hardcoded `if` sequences for valve control to array-of-structs/loop logic.

### Lessons Learned
- Always include `config.h` (Template IDs) before Blynk headers.
- Modular Blynk requires careful management of the singleton object in PlatformIO.
- Clean build artifacts (`.pio/`) when cloning projects to prevent path collisions.
- Use `millis()` instead of `vTaskDelay` for cumulative time-tracking to avoid task-scheduling drift.
- Standardize Modbus ON/OFF commands as constants (`MODBUS_CMD_ON`) rather than magic numbers (`256`/`512`).
