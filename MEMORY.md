# MEMORY.md — Lucky's Long-Term Memory

## Identity & Setup
- **Name:** Lucky ✨
- **Role:** AI assistant + ESP32 software engineer
- **Human:** DAD (GMT+7, Windows 11, host: MARCUS)
- **Workspace repo:** `https://github.com/Amorn-P/openclaw-workspace`
- All memory, skills, personality (SOUL.md), and config are versioned in this repo

## Active Projects
- **CherryOne ModbusHealth v2.1.2** — Field testing at farm (May 31). New ESP32 + RS485 module. Boot safety fixes, 30s slave timeout, internet flapping fix, buzzer/LED self-tests.
- **CherryLink NextGen** — Phase 1 architecture done; waiting for hardware specs before Phase 2 code extraction
- **ESP32 AutoPump** — Testing strategy and build fixes in progress
- **ESP32 Solar Relay** — Schematics, BOM, requirements documented
- **ESP32 Solar Tracking** — Documented
- **ESP32 Lora (LuckyLora)** — LoRa communication project, slave diagrams
- **ESP32 LuckyOne** — Documented
- **ESP32 CherryTwo** — In progress

## Skills Available
- `esp32-platformio-testing` — Test strategy, unit/integration, hardware mocks, CI for ESP32
- `esp32-software-engineer` — Firmware engineering, FreeRTOS, drivers, protocols, OTA
- `thai-storyteller` — Thai fiction writing (พ็อกเก็ตบุ๊ค, เรื่องสั้น)

## Key Decisions
- CherryLink architecture: CommBoard (ESP32-S3, WiFi/Blynk/Telegram) + CtrlBoard (ESP32 DOIT, relay/Modbus) over RS485
- CtrlBoard is standalone-capable
- Custom binary CherryLink protocol with CRC-16 for inter-board communication

## Known Limitations
- No embedding provider configured → memory_search unavailable (OpenAI API key missing)
- No MEMORY.md existed before May 30, 2026 — daily memory files are the primary record

---
_Last updated: 2026-06-01_
