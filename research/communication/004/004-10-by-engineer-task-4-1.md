# Task 4.1: Add UNKNOWN_OPCODE Error Test

**RFC:** 004 (Kernel Remediation)  
**Task:** 4.1  
**Severity:** LOW (Test Coverage)  
**Status:** IMPLEMENTED

---

## Problem

The error path for `ERROR.UNKNOWN_OPCODE` was not covered by tests. While the code exists in `processCommands()` to set this error flag when an unknown opcode is received, there was no test validating this behavior.

---

## Solution

Added a test that:
1. Creates a linker with valid configuration
2. Manually injects an invalid command (opcode 99) into the ring buffer
3. Calls `processCommands()` to process the invalid command
4. Verifies `ERROR.UNKNOWN_OPCODE` is set

```typescript
// Task 4.1: Test UNKNOWN_OPCODE error handling
it('should set ERROR.UNKNOWN_OPCODE for invalid command', () => {
  // nodeCapacity must be power of 2 (Task 3.2)
  const linker = SiliconSynapse.create({ nodeCapacity: 256, safeZoneTicks: 0 })
  const sab = new Int32Array(linker.getSAB())

  // Manually inject invalid command into ring buffer
  const ringOffset = Atomics.load(sab, HDR.COMMAND_RING_PTR) / 4
  const tail = Atomics.load(sab, HDR.RB_TAIL)
  const capacity = Atomics.load(sab, HDR.RB_CAPACITY)
  const writeIdx = ringOffset + (tail % capacity) * 4

  // Write invalid opcode 99 (not a valid CMD.*)
  Atomics.store(sab, writeIdx + 0, 99) // Invalid opcode
  Atomics.store(sab, writeIdx + 1, 0)
  Atomics.store(sab, writeIdx + 2, 0)
  Atomics.store(sab, writeIdx + 3, 0)
  Atomics.store(sab, HDR.RB_TAIL, tail + 1)

  // Process the invalid command
  linker.processCommands()

  expect(linker.getError()).toBe(ERROR.UNKNOWN_OPCODE)
})
```

---

## Ring Buffer Protocol

The test follows the SPSC ring buffer protocol:

1. **Calculate write position**: `ringOffset + (tail % capacity) * 4`
2. **Write command data**: 4 × i32 words (opcode, arg1, arg2, arg3)
3. **Advance tail pointer**: `Atomics.store(sab, HDR.RB_TAIL, tail + 1)`
4. **Process**: Worker calls `processCommands()` which reads from head to tail

---

## Files Changed

1. `packages/kernel/src/__tests__/silicon-linker.test.ts`
   - Added test in `describe('9. Error Handling')` section

---

## Test Results

```
Test Suites: 12 passed, 12 total
Tests:       214 passed, 214 total
Time:        0.968s
```

Test count increased from 213 to 214. The new UNKNOWN_OPCODE test passes.

---

## Valid Opcodes (for reference)

The valid `CMD.*` opcodes are:
- `CMD.NOP = 0`
- `CMD.INSERT = 1`
- `CMD.DELETE = 2`
- `CMD.PATCH = 3`
- `CMD.CONNECT = 4`
- `CMD.DISCONNECT = 5`
- `CMD.BARRIER = 6`

Opcode 99 is clearly invalid and triggers `ERROR.UNKNOWN_OPCODE`.

---

*End of Task 4.1 Log*
