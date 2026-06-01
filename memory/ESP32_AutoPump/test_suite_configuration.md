# Auto Pump Control System - Test Suite Configuration

## Test Directory Structure
```
test/
├── unit/
│   ├── test_relay_board.cpp              # Core relay board functionality
│   ├── test_relay_config.cpp             # Relay configuration tests
│   ├── test_enhanced_integration.cpp     # Enhanced features tests
│   └── test_modbus_operations.cpp        # Modbus communication tests
├── integration/
│   ├── test_relay_integration.cpp        # Full relay system integration
│   ├── test_blynk_integration.cpp        # Blynk communication tests
│   └── test_telegram_integration.cpp     # Telegram communication tests
├── mocks/
│   ├── MockRTU.h                         # Mock for DFRobot_RTU library
│   ├── MockRTU.cpp                       # Implementation of RTU mock
│   ├── MockBlynk.h                       # Mock for Blynk
│   ├── MockWiFi.h                        # Mock for WiFi
│   └── MockPreferences.h                 # Mock for Preferences
├── fixtures/
│   ├── relay_test_data.json              # Test data for relay operations
│   └── timing_test_scenarios.json        # Test scenarios for timing
└── reports/                             # Test reports and coverage data
```

## PlatformIO Test Configuration

### platformio.ini additions:
```ini
[env:esp32dev-test]
platform = espressif32
board = esp32dev
framework = arduino
test_framework = unity
build_type = debug
monitor_speed = 115200
lib_deps = 
    IotWebConf @ 3.2.1
    Blynk
    UniversalTelegramBot @ 1.3.0
    ArduinoJson @ 6.18.5
    NTPClient @ 3.2.1
    DFRobot_RTU @ 1.0.3
    SimpleTimer
    Bounce2
    paulstoffregen/Time @ 1.6.1
build_flags = 
    -D CORE_DEBUG_LEVEL=3
    -D CONFIG_ARDUHAL_LOG_COLORS
    -D UNIT_TESTING=1  ; Define for conditional compilation
    -std=gnu++17

[env:native-test]
platform = native
test_framework = unity
build_flags = -D UNIT_TESTING=1
lib_deps = 
    platformio/unittest
```

## Test Execution Commands

### Running Tests:
```bash
# Run all tests
platformio test

# Run specific environment tests
platformio test -e esp32dev-test

# Run specific test file
platformio test -f test_relay_board

# Run tests with verbose output
platformio test -v

# Run tests and generate coverage report
platformio test --coverage
```

## Test Categories and Priorities

### High Priority Tests (Must Pass)
- [X] relay_init - System initialization
- [X] relay_set_state - Critical relay operation
- [X] relay_get_state - State verification
- [X] relay_emergency_stop - Safety function
- [X] auto_pump_set_relay_state - Main pump control
- [X] Modbus communication with retry logic

### Medium Priority Tests
- [X] Relay validation functions
- [X] System health monitoring
- [X] State persistence
- [X] Blynk integration
- [X] Error handling

### Low Priority Tests
- [X] Detailed status reporting
- [X] Advanced timing functions
- [X] Telegram integration

## Mock Implementation Details

### MockRTU Features:
- Configurable failure patterns (simulate communication errors)
- Timeout simulation
- Register value tracking
- Call counting for verification
- Thread-safe operation simulation

### Test Scenarios Covered:
1. **Normal Operations** - All functions work as expected
2. **Error Conditions** - Communication failures, invalid parameters
3. **Boundary Conditions** - Edge cases, maximum values
4. **Recovery Scenarios** - Retry logic, fallback behavior
5. **Concurrent Access** - Thread safety under load

## Quality Metrics

### Code Coverage Targets:
- Overall: 80% minimum
- Critical functions: 95% minimum
- Error handling: 90% minimum

### Performance Benchmarks:
- Relay operation time: < 50ms average
- Emergency stop execution: < 500ms
- System initialization: < 2000ms

## Continuous Integration Setup

### GitHub Actions Workflow (.github/workflows/test.yml):
```yaml
name: Auto Pump System Tests

on: [push, pull_request]

jobs:
  test-unit:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.9'
    - name: Install PlatformIO
      run: pip install platformio
    - name: Run Unit Tests
      run: |
        platformio test -e native-test -d test/unit
    - name: Generate Coverage Report
      run: |
        platformio test --coverage

  test-integration:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.9'
    - name: Install PlatformIO
      run: pip install platformio
    - name: Run Integration Tests
      run: |
        platformio test -e esp32dev-test -d test/integration

  build-validation:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.9'
    - name: Install PlatformIO
      run: pip install platformio
    - name: Build Main Project
      run: |
        platformio run -e esp32dev
    - name: Static Analysis
      run: |
        platformio check --skip-packages
```

## Test Data Fixtures

### relay_test_data.json:
```json
{
  "valid_sequences": [
    {
      "name": "Full Valve Cycle",
      "description": "Turn each valve on and off in sequence",
      "operations": [
        {"valve": "SV1", "action": "ON", "duration": 1000},
        {"valve": "SV1", "action": "OFF", "duration": 1000},
        {"valve": "SV2", "action": "ON", "duration": 1000},
        {"valve": "SV2", "action": "OFF", "duration": 1000}
      ]
    }
  ],
  "error_conditions": [
    {
      "name": "Invalid Address",
      "operation": {"valve": 100, "action": "ON"},
      "expected_response": "INVALID_ADDRESS"
    },
    {
      "name": "Offline Board",
      "operation": {"valve": "SV1", "action": "ON"},
      "simulate_communication_failure": true,
      "expected_response": "COMM_ERROR"
    }
  ]
}
```

## Test Execution Order

### Pre-flight Checks:
1. Verify all mock objects are properly initialized
2. Check that test fixtures are loaded correctly
3. Ensure system is in known state

### Test Execution Flow:
1. Unit tests (fast, isolated functionality)
2. Integration tests (component interaction)
3. System tests (end-to-end functionality)

### Post-test Actions:
1. Clean up allocated resources
2. Verify no memory leaks
3. Generate test reports
4. Archive test artifacts

## Troubleshooting Common Test Issues

### Mock-related Issues:
- Ensure all virtual functions are properly mocked
- Check that mock expectations match actual calls
- Verify thread safety in mock implementations

### PlatformIO-specific Issues:
- Verify test environment is properly configured
- Check that all dependencies are available
- Ensure proper build flags for testing

This comprehensive test suite will ensure the reliability and maintainability of your Auto Pump Control System.