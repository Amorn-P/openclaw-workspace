# ESP32_CherryTwo Project Memory

## Overview

This project aims to develop a robust ESP32 firmware for controlling a smart watering system, integrating with various sensors and actuators, and providing remote monitoring and control capabilities via a mobile application.

## Key Decisions

- Chosen FreeRTOS for task management to ensure real-time responsiveness.
- Selected MQTT for cloud communication due to its lightweight nature and reliability.
- Implemented a modular architecture to allow for easy expansion and maintenance of sensors and actuators.

## Lessons Learned

- Early integration testing revealed unforeseen timing issues with sensor readings, requiring a robust error-handling mechanism.
- The importance of thorough documentation for module interfaces became apparent during team collaboration, streamlining future development.

## Open Items

- [ ] Test V52 Reset on hardware
- [ ] Test Period1/Period2 schedules on hardware
- [ ] Test Manual relay control (V90-V93)
- [ ] Test Emergency STOP (V93)
- [ ] Sync fixes back to Part1 library

## Test Infrastructure
- 17 native unit tests in `test/test_native/test_cherrytwo.cpp`
- Test gate: `test-gate.ps1` — tests must pass before .bin generation
- Run: `$env:PATH = "...\toolchain-gccmingw32\bin;" + $env:PATH; pio test -e native`

## Bug Fixes (2026-05-19)
- TA[40] loop condition: `i < 38` → `i <= 38` — SV21 (last valve) now works
- WRITE_DEFAULT: gated behind #ifdef DEBUG_BLYNK_PINS
