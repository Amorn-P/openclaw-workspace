# ESP32 Auto Pump Control System - Testing Strategy

## Overview
Testing strategy for the ESP32 Auto Pump Control System with RS485 relay boards, Blynk integration, and Telegram notifications.

## Test Framework Selection
- **Unity** for unit testing (most common for ESP32)
- **CppUTest** as alternative for more advanced features
- **PlatformIO native test support** for seamless integration

## Test Directory Structure
```
test/
├── unit/
│   ├── test_relay_board.cpp          # Unit tests for relay_board module
│   ├── test_relay_config.cpp         # Unit tests for relay configuration
│   ├── test_modbus_operations.cpp    # Unit tests for Modbus RTU operations
│   └── test_timing_logic.cpp         # Unit tests for timing/scheduling
├── integration/
│   ├── test_relay_integration.cpp    # Integration tests for relay system
│   ├── test_blynk_integration.cpp    # Integration tests for Blynk
│   └── test_telegram_integration.cpp # Integration tests for Telegram
├── mocks/
│   ├── MockRTU.h                     # Mock for DFRobot_RTU
│   ├── MockBlynk.h                   # Mock for Blynk
│   ├── MockWiFi.h                    # Mock for WiFi
│   └── MockPreferences.h             # Mock for Preferences
└── fixtures/
    ├── relay_test_data.json          # Test data for relay operations
    └── timing_test_scenarios.json    # Test scenarios for timing
```

## Unit Testing Strategy

### 1. Relay Board Module Tests
```cpp
// test/unit/test_relay_board.cpp
#include <unity.h>
#include "mocks/MockRTU.h"
#include "relay_board.h"

void setUp(void) {
    // Initialize test fixtures
    init_mock_rtu();
}

void tearDown(void) {
    // Clean up after each test
    reset_mock_rtu();
}

void test_relay_init_success(void) {
    DFRobot_RTU* mock_rtu = get_mock_rtu_instance();
    uint8_t addresses[] = {1, 2, 3};
    
    RelayStatus_t result = relay_init(mock_rtu, addresses, 3);
    
    TEST_ASSERT_EQUAL(RELAY_STATUS_OK, result);
    TEST_ASSERT_TRUE(g_relay_system.initialized);
    TEST_ASSERT_EQUAL(3, g_relay_system.board_count);
}

void test_relay_set_state_success(void) {
    // Setup relay system
    // Test setting relay state
    // Verify expected RTU calls were made
}

void test_relay_get_state_success(void) {
    // Setup relay system with known state
    // Test getting relay state
    // Verify returned state matches expected
}

void test_relay_emergency_stop(void) {
    // Setup with some relays ON
    RelayStatus_t result = relay_emergency_stop();
    
    TEST_ASSERT_EQUAL(RELAY_STATUS_OK, result);
    // Verify all relays are now OFF
}

int main(void) {
    UNITY_BEGIN();
    RUN_TEST(test_relay_init_success);
    RUN_TEST(test_relay_set_state_success);
    RUN_TEST(test_relay_get_state_success);
    RUN_TEST(test_relay_emergency_stop);
    return UNITY_END();
}
```

### 2. Relay Configuration Tests
```cpp
// test/unit/test_relay_config.cpp
#include <unity.h>
#include "relay_config.h"

void test_auto_pump_relay_init(void) {
    // Test the auto_pump_relay_init wrapper function
    DFRobot_RTU* mock_rtu = get_mock_rtu_instance();
    
    RelayStatus_t result = auto_pump_relay_init(mock_rtu);
    
    TEST_ASSERT_EQUAL(RELAY_STATUS_OK, result);
    TEST_ASSERT_EQUAL(AUTO_PUMP_BOARD_COUNT, g_relay_system.board_count);
}

void test_auto_pump_set_relay_state(void) {
    // Test individual relay functions by name
    RelayStatus_t result = auto_pump_set_relay_state(RELAY_SV1, MODBUS_CMD_ON);
    
    TEST_ASSERT_EQUAL(RELAY_STATUS_OK, result);
    // Verify correct board and relay index were used
}

void test_invalid_relay_validation(void) {
    // Test validation functions
    TEST_ASSERT_TRUE(IS_VALID_AUTO_PUMP_RELAY(RELAY_SV1));
    TEST_ASSERT_FALSE(IS_VALID_AUTO_PUMP_RELAY(100)); // Out of range
}
```

### 3. Modbus Communication Tests
```cpp
// test/unit/test_modbus_operations.cpp
#include <unity.h>
#include "mocks/MockRTU.h"
#include "relay_board.h"

void test_modbus_retry_logic(void) {
    // Configure mock to fail first 2 attempts, succeed on 3rd
    configure_mock_failure_pattern(2, 1); // 2 failures, then 1 success
    
    RelayStatus_t result = relay_set_state(0, 0, MODBUS_CMD_ON);
    
    TEST_ASSERT_EQUAL(RELAY_STATUS_OK, result);
    TEST_ASSERT_EQUAL(3, get_mock_call_count()); // Should have retried 3 times
}

void test_modbus_timeout_handling(void) {
    // Configure mock to simulate timeout
    configure_mock_timeout();
    
    RelayStatus_t result = relay_set_state(0, 0, MODBUS_CMD_ON);
    
    TEST_ASSERT_EQUAL(RELAY_STATUS_COMM_ERROR, result);
    TEST_ASSERT_EQUAL(3, get_mock_call_count()); // Should retry up to max attempts
}
```

## Mock Implementations

### Mock RTU Class
```cpp
// test/mocks/MockRTU.h
#ifndef MOCK_RTU_H
#define MOCK_RTU_H

#include "DFRobot_RTU.h"

class MockRTU : public DFRobot_RTU {
private:
    int fail_count = 0;
    int success_after = 0;
    int call_count = 0;
    bool simulate_timeout = false;

public:
    MockRTU();
    
    int writeHoldingRegister(uint8_t slaveAddr, uint16_t regAddr, uint16_t value) override;
    int readHoldingRegister(uint8_t slaveAddr, uint16_t regAddr) override;
    
    void configureFailurePattern(int failures, int success_after);
    void configureTimeout();
    int getCallCount();
    void reset();
};

// Global mock instance for testing
extern MockRTU* mock_rtu_instance;

MockRTU* get_mock_rtu_instance();
void init_mock_rtu();
void reset_mock_rtu();

#endif
```

### Mock Blynk Class
```cpp
// test/mocks/MockBlynk.h
#ifndef MOCK_BLYNK_H
#define MOCK_BLYNK_H

#include <Blynk.h>

class MockBlynk {
private:
    bool connected_status = true;
    std::map<int, int> virtual_pins;
    std::vector<String> logged_messages;

public:
    void begin(const char* auth, const char* ssid, const char* pass);
    void run();
    bool connected();
    void disconnect();
    void connect();
    
    template<typename TVPIN>
    void virtualWrite(int pin, TVPIN value);
    
    // Methods for test verification
    String getLastLoggedMessage();
    int getVirtualPinValue(int pin);
    void reset();
};

extern MockBlynk* mock_blynk_instance;

#endif
```

## Integration Testing Strategy

### 1. Relay System Integration Test
```cpp
// test/integration/test_relay_integration.cpp
#include <unity.h>
#include "relay_board.h"
#include "relay_config.h"
#include "mocks/MockRTU.h"

void test_complete_relay_operation_sequence(void) {
    // Initialize relay system
    DFRobot_RTU* mock_rtu = get_mock_rtu_instance();
    TEST_ASSERT_EQUAL(RELAY_STATUS_OK, auto_pump_relay_init(mock_rtu));
    
    // Test sequence: turn on valve, check state, turn off, verify off
    TEST_ASSERT_EQUAL(RELAY_STATUS_OK, auto_pump_set_relay_state(RELAY_SV1, MODBUS_CMD_ON));
    
    uint16_t state;
    TEST_ASSERT_EQUAL(RELAY_STATUS_OK, auto_pump_get_relay_state(RELAY_SV1, &state));
    TEST_ASSERT_EQUAL(MODBUS_CMD_ON, state);
    
    TEST_ASSERT_EQUAL(RELAY_STATUS_OK, auto_pump_set_relay_state(RELAY_SV1, MODBUS_CMD_OFF));
    TEST_ASSERT_EQUAL(RELAY_STATUS_OK, auto_pump_get_relay_state(RELAY_SV1, &state));
    TEST_ASSERT_EQUAL(MODBUS_CMD_OFF, state);
}

void test_multiple_relay_concurrent_access(void) {
    // Test thread safety with multiple simultaneous operations
    // This would involve creating multiple threads accessing relays
    // and verifying no race conditions occur
}
```

### 2. Blynk Integration Test
```cpp
// test/integration/test_blynk_integration.cpp
#include <unity.h>
#include "mocks/MockBlynk.h"
#include "enhanced_integration.h"

void test_blynk_connection_recovery(void) {
    // Test Blynk disconnection and reconnection logic
    TEST_ASSERT_TRUE(handleBlynkConnection()); // Should connect initially
    
    // Simulate disconnection
    simulate_blynk_disconnect();
    
    // Allow some time for reconnection attempts
    for(int i = 0; i < 5; i++) {
        handleBlynkConnection();
        delay(1000);
    }
    
    // Verify reconnection occurred
    TEST_ASSERT_TRUE(get_mock_blynk_instance()->connected());
}
```

## PlatformIO Configuration for Testing

### platformio.ini additions:
```ini
[env:esp32dev-test]
extends = env:esp32dev
build_type = debug
test_framework = unity
upload_protocol = no_upload  ; Tests run on host, not device
lib_deps = 
    ${env.lib_deps}
    ; Additional test libraries
    unity

[platformio]
description = Auto Pump Control System with testing
test_dir = test
```

## CI Pipeline Configuration

### .github/workflows/test.yml:
```yaml
name: ESP32 Auto Pump Tests

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Install Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.9'
    
    - name: Install PlatformIO
      run: pip install platformio
      
    - name: Run Unit Tests
      run: platformio test -e esp32dev-test
      
    - name: Run Static Analysis
      run: platformio check --skip-packages
      
    - name: Build for Device
      run: platformio run -e esp32dev
```

## Test Data and Fixtures

### Sample relay test data:
```json
{
  "valid_sequences": [
    {
      "name": "Full Cycle Test",
      "operations": [
        {"relay": "RELAY_SV1", "command": "ON", "expected_response": "OK"},
        {"relay": "RELAY_SV2", "command": "ON", "expected_response": "OK"},
        {"relay": "RELAY_SV1", "command": "OFF", "expected_response": "OK"},
        {"relay": "RELAY_SV2", "command": "OFF", "expected_response": "OK"}
      ]
    }
  ],
  "error_conditions": [
    {
      "name": "Invalid Address",
      "operation": {"relay": 100, "command": "ON"},
      "expected_response": "INVALID_ADDRESS"
    }
  ]
}
```

## Running Tests

### Local Test Commands:
```bash
# Run all tests
platformio test

# Run specific test environment
platformio test -e esp32dev-test

# Run tests in verbose mode
platformio test -v

# Run specific test file
platformio test -f test_relay_board
```

## Test Coverage Goals

- **Unit Tests**: 80%+ coverage of core logic functions
- **Integration Tests**: All major system components tested together
- **Edge Cases**: Error handling, boundary conditions, race conditions
- **Hardware Mocks**: All hardware dependencies properly mocked

## Quality Gates

- All tests must pass before merging
- Code coverage must remain above 80%
- No memory leaks in tests
- Tests must be deterministic and reproducible

This testing strategy will ensure your Auto Pump Control System remains reliable and maintainable as it evolves.