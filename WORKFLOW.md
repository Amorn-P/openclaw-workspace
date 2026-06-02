# WORKFLOW.md — Tier 1 Multi-Agent ESP32 Development Pipeline

## 🎯 System Architecture (Tier 1)

This document defines the automated, multi-agent workflow for ESP32 firmware development. 
The goal is to eliminate manual debugging cycles, ensure high-quality code, and minimize human intervention to only what is physically necessary.

### 🛠️ The Toolchain
1. **OpenClaw (Lucky)**: The Orchestrator and System Architect. Manages the pipeline, writes SPECs, and prompts Cursor.
2. **Cursor IDE ($20/mo)**: The Code Generator. Reads precise prompts and SPEC.md to generate C++ firmware and Wokwi JSON diagrams.
3. **Hermes (OpenClaw Sub-Agent)**: The Second Opinion / Senior Code Reviewer. Audits generated code for memory leaks, race conditions, and edge cases.
4. **Wokwi Simulator (Hobby+ $12/mo)**: The Logic Verifier. Runs the compiled firmware in a virtual environment to catch logic bugs before flashing.
5. **PlatformIO (Free)**: The Build & Deployment Engine. Compiles code and flashes to physical hardware.

---

## 👥 Roles & Responsibilities

| Role | Who | Responsibility |
|------|-----|----------------|
| **Project Owner** | DAD | Defines requirements. Performs physical wiring. Deploys to field. |
| **System Architect** | Lucky | Clarifies requirements, writes `SPEC.md`, generates Cursor prompts. |
| **Code Generator** | Cursor IDE | Writes `main.cpp`, headers, and `diagram.json` based on prompts. |
| **Senior Reviewer** | Hermes (Sub-Agent) | Audits code strictly for vulnerabilities, state machine flaws, and safety. |
| **Pipeline Manager** | Lucky | Triggers builds, runs Wokwi, evaluates serial output, acts as the gatekeeper. |

---

## 🔄 The 7-Step Development Loop

### GATE 1: Requirement & Architecture
1. **DAD** requests a feature or project (natural language).
2. **Lucky** asks clarifying questions (pinouts, states, protocols).
3. **Lucky** generates `SPEC.md` (The Single Source of Truth).
4. **DAD** confirms `SPEC.md`.

### GATE 2: Code Generation
5. **Lucky** writes a precise prompt for Cursor (specifying exact file paths and logic constraints).
6. **Cursor Agent** reads `SPEC.md` and generates code + `wokwi/diagram.json`.

### GATE 3: The Second Opinion (Hermes Audit)
7. **Lucky** spawns a Hermes sub-agent, passing it the generated code.
8. **Hermes** reviews code for:
   - FreeRTOS safety (mutexes, stack sizes, queue blocking)
   - Pointer/Memory safety
   - Edge case handling (e.g., WiFi drops, brownouts)
9. If **Hermes** finds flaws → **Lucky** instructs **Cursor** to fix them. Loop repeats until Hermes passes.

### GATE 4: Simulation
10. **Lucky** runs PlatformIO build.
11. If build passes, **Lucky** runs Wokwi simulation.
12. **Lucky** checks simulated serial output for expected success keywords (e.g., `Self-test: PASS`).
13. If simulation fails → **Lucky** instructs **Cursor** to fix. Loop repeats until Wokwi passes.

### GATE 5: Bench Testing (Physical)
14. **Lucky** informs **DAD**: *"Code is clean, reviewed, and simulated. Ready for bench."*
15. **DAD** wires the ESP32-S3 bench unit + Logic Analyzer + USB-RS485 isolated module.
16. **Lucky** flashes firmware via PlatformIO.
17. **Lucky/DAD** verify physical signals (Logic Analyzer for SPI/RS485).

### GATE 6: Field Deployment
18. **DAD** takes the validated firmware/board to the field (e.g., Farm).
19. **DAD** installs and monitors.

### GATE 7: Feedback & Iteration
20. If **DAD** finds a bug in the field, report it to **Lucky**.
21. **Lucky** updates the `Known Issues` in `SPEC.md`.
22. The loop restarts from GATE 2 to fix the issue.

---

## 📏 Golden Rules
1. **No SPEC, No Code.** Every change starts with updating `SPEC.md`.
2. **Never skip Hermes.** The second opinion is mandatory for production firmware.
3. **Never flash logic bugs.** Simulation must pass before hardware is plugged in.
4. **Hardware bugs are physical.** Bad modules and loose wires require DAD's hands; software cannot fix a broken MAX485 chip.