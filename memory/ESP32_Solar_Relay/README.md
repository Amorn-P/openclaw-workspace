# ESP32 Solar Relay Controller (Pro Edition)

This project is an industrial-grade, solar-powered relay controller designed for high reliability and autonomous operation. It uses precision current sensing to manage a Solid State Relay (SSR) based on available solar energy.

## 🚀 Key Features
- **High-Precision Sensing:** INA226 I2C monitor for voltage and current.
- **Silent & Efficient Switching:** DC-DC Solid State Relay (SSR-25DD) with PC817 opto-isolation.
- **Industrial Protection:** TVS diode surge protection and large 2200uF buffer capacitance.
- **Autonomous Logic:** Functions independently of WiFi/Cloud status.
- **Remote Monitoring:** Integrated with Legacy Blynk (Server 43.229.135.169).
- **Maintenance-Ready:** Built-in OTA update capability.

## 📁 Project Structure
- `src/`: Firmware source code.
- `REQUIREMENTS.md`: Functional and technical specifications.
- `WORKFLOW.md`: Logic execution and state transitions.
- `BOM.md`: Detailed Bill of Materials.
- `IMPORTANT_NOTES.md`: Critical design decisions and safety warnings.
- `SCHEMATIC_GUIDE.excalidraw`: Visual wiring reference.
