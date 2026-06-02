# Agentic Workflow Management (ESP32 Tier 1)

**Description:** Use this skill to orchestrate the multi-agent ESP32 development pipeline. It guides you through managing the interaction between DAD (requirements), yourself (architect), Cursor (code gen), Hermes (reviewer), Wokwi (simulator), and PlatformIO (build).

## Pipeline Gates

When executing an ESP32 task, follow this exact state machine. Do not skip steps.

### Phase 1: SPEC Generation
1. Read the user's request.
2. Ask clarifying questions regarding Hardware, GPIO, Modbus registers, FSM states, and failure modes.
3. Generate or update `SPEC.md` in the project root.
4. Ask DAD to approve the SPEC.

### Phase 2: Cursor Prompting
1. Once SPEC is approved, generate a precise prompt for Cursor IDE.
2. The prompt must instruct Cursor to:
   - Read `SPEC.md`.
   - Update C++ firmware files (`src/main.cpp`, `config.h`, etc.).
   - Update `wokwi/diagram.json` to match the GPIO layout.
3. Provide this prompt to DAD to paste into Cursor (or execute via file watch if API connected).

### Phase 3: Hermes Second Opinion (Crucial)
1. Once code is generated, use `sessions_spawn` to invoke a sub-agent (representing Hermes/Senior Code Reviewer).
2. **Context:** Provide the generated C++ files and `SPEC.md`.
3. **Prompt to Sub-agent:** "You are a ruthless Senior Embedded C++ Reviewer. Audit this code for memory leaks, FreeRTOS race conditions, incorrect Modbus timing, and unhandled hardware failure states. Output PASS or a list of FLAW findings."
4. If Hermes finds flaws, generate a new prompt for Cursor to fix them. Loop until Hermes says PASS.

### Phase 4: Simulation & Build
1. Instruct the build system (PlatformIO) to compile: `pio run`.
2. Run Wokwi simulation (either via CLI or asking DAD to run inside Cursor).
3. Review serial output. Look for expected "OK" or "PASS" keywords.
4. If logic bugs appear, update `SPEC.md` with the new edge case, and return to Phase 2.

### Phase 5: Hardware Handoff
1. If Wokwi passes, instruct DAD to connect the bench hardware.
2. Run `pio run -t upload`.
3. Confirm physical signals using Logic Analyzer if dealing with RS485/SPI/I2C.
4. Hand off to DAD for field deployment.

## Key Rules
- **NEVER assume the generated code is safe without Hermes reviewing it.**
- **NEVER ask DAD to flash firmware if it hasn't passed Wokwi simulation.**
- **Hardware bugs cannot be fixed in software.** If simulation passes but bench fails, tell DAD to check wiring or replace modules.
