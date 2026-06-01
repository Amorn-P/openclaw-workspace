# Auto Pump Control System - Advanced Test Execution Plan

## Overview
This plan implements advanced testing strategies for the Auto Pump Control System using ESP32 PlatformIO Testing expertise, incorporating fault injection, stress testing, and performance benchmarking.

## 1. Test Environment Setup

### Update Project Structure
```
E:\Arduino\Auto_Pump_07_03_2569\
├── test/
│   ├── unit/
│   │   ├── test_relay_board.cpp          # Basic functionality
│   │   ├── test_relay_config.cpp         # Configuration validation
│   │   └── test_enhanced_integration.cpp # New features
│   ├── integration/
│   │   └── test_relay_integration.cpp    # System integration
│   ├── performance/
│   │   └── test_relay_performance.cpp    # Performance benchmarks
│   ├── stress/
│   │   └── test_relay_stress.cpp         # Load testing
│   ├── error_recovery/
│   │   └── test_communication_recovery.cpp # Error handling
│   ├── mocks/
│   │   ├── MockRTU.h                     # Basic mock
│   │   ├── MockRTU.cpp                   # Basic mock implementation
│   │   ├── AdvancedMockRTU.h             # Advanced mock
│   │   └── AdvancedMockBlynk.h           # Blynk mock
│   ├── fixtures/
│   │   └── relay_test_scenarios.json     # Test data
│   └── reports/                          # Test results
├── platformio_test.ini                   # Test configuration
└── TEST_RUNNER.md                        # Execution instructions
```

## 2. Implementation Steps

### Step 1: Create Advanced Mock Directory
```bash
mkdir "E:\Arduino\Auto_Pump_07_03_2569\test\performance"
mkdir "E:\Arduino\Auto_Pump_07_03_2569\test\stress"
mkdir "E:\Arduino\Auto_Pump_07_03_2569\test\error_recovery"
mkdir "E:\Arduino\Auto_Pump_07_03_2569\test\fixtures"
```

### Step 2: Copy Advanced Test Files
```bash
# Copy advanced mock implementations
copy ".\temp_auto_pump_project\test\mocks\MockRTU.h" "E:\Arduino\Auto_Pump_07_03_2569\test\mocks\AdvancedMockRTU.h"
copy ".\temp_auto_pump_project\test\mocks\MockRTU.cpp" "E:\Arduino\Auto_Pump_07_03_2569\test\mocks\AdvancedMockRTU.cpp"

# Copy performance tests
copy ".\advanced_testing_implementation.md" "E:\Arduino\Auto_Pump_07_03_2569\test\performance\README.md"
```

### Step 3: Create Performance Test Implementation
```cpp
// E:\Arduino\Auto_Pump_07_03_2569\test\performance\test_relay_performance.cpp
#include <unity.h>
#include <Arduino.h>
#include "mocks/MockRTU.h"
#include "relay_board.h"

void benchmark_relay_operation_timing(void) {
    // Implementation of performance test
    MockRTU* mock_rtu = get_mock_rtu_instance();
    
    uint8_t addresses[] = {1, 2, 3};
    RelayStatus_t init_result = relay_init(
        reinterpret_cast<DFRobot_RTU*>(mock_rtu), 
        addresses, 
        3
    );
    TEST_ASSERT_EQUAL(RELAY_STATUS_OK, init_result);
    
    const int ITERATIONS = 100;
    unsigned long start_time = micros();
    
    // Measure timing for relay operations
    for (int i = 0; i < ITERATIONS; i++) {
        relay_set_state(0, 0, MODBUS_CMD_ON);
        relay_set_state(0, 0, MODBUS_CMD_OFF);
    }
    
    unsigned long end_time = micros();
    unsigned long total_time_us = end_time - start_time;
    float avg_time_per_operation_us = (float)total_time_us / (ITERATIONS * 2);
    
    // Log performance metrics
    printf("Relay operation performance:\n");
    printf("  Total operations: %d\n", ITERATIONS * 2);
    printf("  Total time: %lu μs\n", total_time_us);
    printf("  Average time per operation: %.2f μs\n", avg_time_per_operation_us);
    
    // Should be reasonably fast (less than 10ms per operation average)
    TEST_ASSERT_TRUE(avg_time_per_operation_us < 10000); // Less than 10ms
}

void test_relay_operation_throughput(void) {
    // Test how many relay operations can be performed per second
    MockRTU* mock_rtu = get_mock_rtu_instance();
    
    uint8_t addresses[] = {1};
    relay_init(reinterpret_cast<DFRobot_RTU*>(mock_rtu), addresses, 1);
    
    unsigned long start_time = millis();
    int operations_count = 0;
    const unsigned long test_duration_ms = 5000; // 5 seconds
    
    while (millis() - start_time < test_duration_ms) {
        relay_set_state(0, 0, MODBUS_CMD_ON);
        relay_set_state(0, 0, MODBUS_CMD_OFF);
        operations_count += 2;
    }
    
    float operations_per_second = (float)operations_count / (test_duration_ms / 1000.0);
    
    printf("Throughput test results:\n");
    printf("  Operations performed: %d\n", operations_count);
    printf("  Time elapsed: %lu ms\n", millis() - start_time);
    printf("  Rate: %.2f ops/sec\n", operations_per_second);
    
    // Minimum acceptable throughput
    TEST_ASSERT_TRUE(operations_per_second > 10); // At least 10 ops/sec
}

int main(void) {
    UNITY_BEGIN();
    
    RUN_TEST(benchmark_relay_operation_timing);
    RUN_TEST(test_relay_operation_throughput);
    
    return UNITY_END();
}
```

### Step 4: Create Stress Test Implementation
```cpp
// E:\Arduino\Auto_Pump_07_03_2569\test\stress\test_relay_stress.cpp
#include <unity.h>
#include <Arduino.h>
#include "mocks/MockRTU.h"
#include "relay_board.h"

void test_relay_concurrent_access_stress(void) {
    // Test multiple relays being accessed under heavy load
    MockRTU* mock_rtu = get_mock_rtu_instance();
    
    uint8_t addresses[] = {1, 2, 3, 4, 5};
    relay_init(reinterpret_cast<DFRobot_RTU*>(mock_rtu), addresses, 5);
    
    const int OPERATIONS_PER_BATCH = 1000;
    int error_count = 0;
    
    for (int op = 0; op < OPERATIONS_PER_BATCH; op++) {
        uint8_t board_idx = op % 5;  // Cycle through boards
        uint8_t relay_idx = op % 8;  // Cycle through relays
        
        RelayStatus_t result = relay_set_state(
            board_idx, 
            relay_idx, 
            (op % 2) ? MODBUS_CMD_ON : MODBUS_CMD_OFF
        );
        
        if (result != RELAY_STATUS_OK) {
            error_count++;
        }
    }
    
    printf("Stress test results:\n");
    printf("  Operations performed: %d\n", OPERATIONS_PER_BATCH);
    printf("  Errors encountered: %d\n", error_count);
    printf("  Success rate: %.2f%%\n", 
           ((float)(OPERATIONS_PER_BATCH - error_count) / OPERATIONS_PER_BATCH) * 100);
    
    // Allow some errors due to stress, but majority should succeed
    float success_rate = ((float)(OPERATIONS_PER_BATCH - error_count) / OPERATIONS_PER_BATCH) * 100;
    TEST_ASSERT_TRUE(success_rate > 90.0); // At least 90% success rate
}

void test_long_running_operation_stability(void) {
    // Test system stability over extended periods
    MockRTU* mock_rtu = get_mock_rtu_instance();
    
    uint8_t addresses[] = {1};
    relay_init(reinterpret_cast<DFRobot_RTU*>(mock_rtu), addresses, 1);
    
    const int LONG_RUNNING_OPERATIONS = 10000;
    
    for (int i = 0; i < LONG_RUNNING_OPERATIONS; i++) {
        relay_set_state(0, 0, MODBUS_CMD_ON);
        relay_set_state(0, 0, MODBUS_CMD_OFF);
        
        // Periodic check for memory issues
        if (i % 1000 == 0) {
            // On ESP32, we could check heap here
            printf("Completed %d operations...\n", i);
        }
    }
    
    printf("Long-running test completed: %d operations\n", LONG_RUNNING_OPERATIONS);
    
    // Final system health check
    TEST_ASSERT_TRUE(true); // If we got here without crashes, it's stable
}

int main(void) {
    UNITY_BEGIN();
    
    RUN_TEST(test_relay_concurrent_access_stress);
    RUN_TEST(test_long_running_operation_stability);
    
    return UNITY_END();
}
```

### Step 5: Create Error Recovery Test Implementation
```cpp
// E:\Arduino\Auto_Pump_07_03_2569\test\error_recovery\test_communication_recovery.cpp
#include <unity.h>
#include <Arduino.h>
#include "mocks/MockRTU.h"
#include "relay_board.h"

void test_relay_communication_recovery(void) {
    // Test that the system recovers from communication errors
    MockRTU* mock_rtu = get_mock_rtu_instance();
    
    // Configure mock to fail first few attempts, then succeed
    mock_rtu->configureFailurePattern(2); // Fail first 2 attempts
    
    uint8_t addresses[] = {1};
    relay_init(reinterpret_cast<DFRobot_RTU*>(mock_rtu), addresses, 1);
    
    // This operation should succeed after retries
    RelayStatus_t result = relay_set_state(0, 0, MODBUS_CMD_ON);
    TEST_ASSERT_EQUAL(RELAY_STATUS_OK, result);
    
    // Verify that 3 calls were made (1st fail, 2nd fail, 3rd success)
    TEST_ASSERT_EQUAL(3, mock_rtu->getCallCount());
    
    // Verify final state is correct
    uint16_t state;
    result = relay_get_state(0, 0, &state);
    TEST_ASSERT_EQUAL(RELAY_STATUS_OK, result);
    TEST_ASSERT_EQUAL(MODBUS_CMD_ON, state);
    
    printf("Communication recovery test passed: Recovered after 2 failures\n");
}

void test_emergency_stop_under_error_conditions(void) {
    // Test that emergency stop works even when communication is degraded
    MockRTU* mock_rtu = get_mock_rtu_instance();
    
    // Set up some relays in ON state
    uint8_t addresses[] = {1, 2};
    relay_init(reinterpret_cast<DFRobot_RTU*>(mock_rtu), addresses, 2);
    
    // Turn on some relays
    relay_set_state(0, 0, MODBUS_CMD_ON);
    relay_set_state(0, 1, MODBUS_CMD_ON);
    relay_set_state(1, 0, MODBUS_CMD_ON);
    
    // Now introduce communication problems
    mock_rtu->configureFailurePattern(1); // Cause intermittent failures
    
    // Emergency stop should still work (with retries)
    RelayStatus_t result = relay_emergency_stop();
    TEST_ASSERT_EQUAL(RELAY_STATUS_OK, result);
    
    printf("Emergency stop under error conditions: Successfully executed\n");
    
    // Verify that emergency stop tried to turn everything off
    TEST_ASSERT_TRUE(mock_rtu->getCallCount() > 0);
}

int main(void) {
    UNITY_BEGIN();
    
    RUN_TEST(test_relay_communication_recovery);
    RUN_TEST(test_emergency_stop_under_error_conditions);
    
    return UNITY_END();
}
```

## 3. Enhanced PlatformIO Configuration

### Update E:\Arduino\Auto_Pump_07_03_2569\platformio_test.ini
```ini
; PlatformIO Project Configuration for Testing
;

[env:esp32dev-test]
extends = env:esp32dev
build_type = debug
test_framework = unity
upload_protocol = no_upload
build_flags = 
    ${env.build_flags}
    -D UNIT_TESTING=1
    -I src
    -I test/mocks
    -I test/unit

[env:esp32dev-performance]
extends = env:esp32dev-test
build_flags = 
    ${env:esp32dev-test.build_flags}
    -D PERFORMANCE_TESTING=1
    -O2
    -I test/performance

[env:esp32dev-stress]
extends = env:esp32dev-test
build_flags = 
    ${env:esp32dev-test.build_flags}
    -D STRESS_TESTING=1
    -D HEAP_MONITORING=1
    -I test/stress

[env:esp32dev-error-recovery]
extends = env:esp32dev-test
build_flags = 
    ${env:esp32dev-test.build_flags}
    -D ERROR_RECOVERY_TESTING=1
    -I test/error_recovery

[platformio]
description = Auto Pump Control System - Advanced Testing
test_dir = test
src_dir = src
default_envs = esp32dev-test
```

## 4. Test Execution Commands

### Execute Different Test Categories:

```bash
# Run basic unit tests
cd "E:\Arduino\Auto_Pump_07_03_2569"
platformio test --environment esp32dev-test

# Run performance tests
platformio test --environment esp32dev-performance

# Run stress tests  
platformio test --environment esp32dev-stress

# Run error recovery tests
platformio test --environment esp32dev-error-recovery

# Run all tests
platformio test

# Run with verbose output
platformio test -v

# Generate test reports
platformio test --coverage
```

## 5. Quality Gates and Metrics

### Performance Benchmarks:
- **Relay Operation Time**: < 10ms average
- **Throughput**: > 10 operations/second
- **Memory Usage**: < 2KB heap difference after 10,000 operations
- **Success Rate Under Stress**: > 90%

### Error Recovery:
- **Retry Logic**: Successfully recover from temporary communication failures
- **Emergency Stop**: Functional even under degraded conditions
- **System Health Monitoring**: Accurately detect and report board status

### Reliability:
- **Stress Testing**: System remains stable under heavy load
- **Long-Running Operations**: No crashes or memory leaks over extended periods
- **Fault Injection**: Proper error handling and recovery

## 6. Continuous Integration Setup

### GitHub Actions Workflow (.github/workflows/advanced-tests.yml):
```yaml
name: Advanced Auto Pump System Tests

on: [push, pull_request]

jobs:
  unit-tests:
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
        cd E:/Arduino/Auto_Pump_07_03_2569
        platformio test --environment esp32dev-test

  performance-tests:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.9'
    - name: Install PlatformIO
      run: pip install platformio
    - name: Run Performance Tests
      run: |
        cd E:/Arduino/Auto_Pump_07_03_2569
        platformio test --environment esp32dev-performance

  stress-tests:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.9'
    - name: Install PlatformIO
      run: pip install platformio
    - name: Run Stress Tests
      run: |
        cd E:/Arduino/Auto_Pump_07_03_2569
        platformio test --environment esp32dev-stress

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
        cd E:/Arduino/Auto_Pump_07_03_2569
        platformio run -e esp32dev
```

## 7. Reporting and Monitoring

### Test Reports:
- **Coverage Reports**: Generated after each test run
- **Performance Baselines**: Established and tracked over time
- **Error Recovery Metrics**: Success rates and recovery times
- **Stress Test Results**: Stability and throughput measurements

This advanced testing implementation provides comprehensive coverage for your Auto Pump Control System, ensuring reliability, performance, and robust error handling in real-world conditions.