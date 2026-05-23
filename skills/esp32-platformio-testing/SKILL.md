---
name: esp32-platformio-testing
description: "Expert for ESP32 software testing on PlatformIO. Use for test strategy, unit/integration tests, hardware mocks, and CI integration for ESP32 projects."
---

Body:
- Purpose: Define robust testing practices for ESP32 firmware using PlatformIO.
- When to use: Writing tests, setting up test frameworks, mocking hardware, and integrating tests into CI.
- Core workflows:
  - Choose testing framework (e.g., Unity) and integrate with PlatformIO
  - Create unit tests for drivers and core logic; mock hardware peripherals
  - Write integration tests that simulate sensor/actuator behavior
  - Set up local/CI pipelines to run tests on push/PR
  - Maintain test data and fixtures; ensure reproducible test runs
- Common commands:
  - platformio test -e espidf (or appropriate environment)
  - commands to run mocks and capture logs
- Bundled resources (optional): references/pytest-templates.md, mocks/ (example mock implementations), ci/ (example GitHub Actions workflow)
