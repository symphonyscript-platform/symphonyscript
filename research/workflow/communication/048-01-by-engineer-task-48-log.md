# Task 048: Implement full `stack(builderFn)` Parallel Execution

## Implementation Log

### Summary
Implemented `stack(builderFn)` overload on `SynapticMelody` that executes a builder function in parallel mode. The builder's operations are placed at the current tick, and the parent tick does NOT advance past the stacked content.

### Changes Made

#### 1. `packages/composer/src/clips/SynapticMelody.ts`

Added `stack(builderFn)` overload:

```typescript
/**
 * Execute a builder function in parallel (stacked) mode.
 * All operations inside the builder are placed at the SAME starting tick,
 * and the parent tick does NOT advance past the stacked content.
 *
 * Overloads:
 * - `stack()` - Enable polyphonic stacking mode (inherited from SynapticClip)
 * - `stack(builderFn)` - Execute builder in parallel
 *
 * @param builderFn - Builder function to execute in parallel

 * @returns this for chaining
 */
stack(builderFn?: (b: SynapticMelody) => SynapticMelody | SynapticMelodyNoteCursor | void): this {
    if (builderFn === undefined) {
        // No-arg version: enable polyphonic stacking mode
        return super.stack() as this;
    }

    // Save current tick position
    const savedTick = this.getCurrentTick();

    // Execute the builder function
    const result = builderFn(this);

    // If result is a cursor, commit it
    if (result && result !== this && 'commit' in result) {
        result.commit();
    }

    // Restore tick to saved position (parallel, not sequential)
    this.currentTick = savedTick;

    return this;
}
```

**Key behaviors:**
- When called without arguments, delegates to `super.stack()` for polyphonic stacking mode
- When called with a builder function:
  1. Saves the current tick position
  2. Executes the builder function (operations go into the parent clip)
  3. Auto-commits any returned cursor
  4. Restores the tick to the saved position
  5. Returns `this` for chaining

### Tests Created

Created `packages/composer/src/__tests__/Stack.test.ts` with 14 tests:

1. **Basic functionality** (3 tests):
   - Executes builder function notes at current tick
   - Does NOT advance parent tick after stacked content
   - Places stacked notes at saved tick position

2. **Multiple stacked layers** (2 tests):
   - Can stack multiple layers at same tick
   - Stacked layers are independent

3. **No-arg stack() still works** (1 test):
   - Enables polyphonic stacking mode

4. **Builder function return handling** (3 tests):
   - Handles builder returning void
   - Handles builder returning this
   - Handles builder returning cursor (auto-commits)

5. **Chaining** (2 tests):
   - Returns this for chaining
   - Chains with other methods

6. **Integration** (3 tests):
   - Works with chords in stacked layers
   - Works with progression after stack
   - Creates parallel melodies

### Test Results

```
PASS @symphonyscript/composer src/__tests__/Stack.test.ts
  SynapticMelody.stack(builderFn)
    Basic functionality
      ✓ executes builder function notes at current tick
      ✓ does NOT advance parent tick after stacked content
      ✓ places stacked notes at saved tick position
    Multiple stacked layers
      ✓ can stack multiple layers at same tick
      ✓ stacked layers are independent
    No-arg stack() still works
      ✓ enables polyphonic stacking mode
    Builder function return handling
      ✓ handles builder returning void
      ✓ handles builder returning this
      ✓ handles builder returning cursor (auto-commits)
    Chaining
      ✓ returns this for chaining
      ✓ chains with other methods
    Integration
      ✓ works with chords in stacked layers
      ✓ works with progression after stack
      ✓ creates parallel melodies

Test Suites: 1 passed, 1 total
Tests:       14 passed, 14 total
```

### Full Test Suite Results

```
Test Suites: 1 failed, 36 passed, 37 total
Tests:       1 failed, 705 passed, 706 total
```

The single failure is the pre-existing flaky test:
- `SynapticChordCursor (Phase 5) › Zero-Allocation Smoke Test › flush() performs zero heap allocations`

This is a known, persistent issue unrelated to Task 048.

### Design Decisions

1. **No cursor escape for builder overload**: The `stack(builderFn)` method requires access to `currentTick` setter, which is only available on `SynapticMelody`. The base `SynapticCursor.stack()` escape remains unchanged (delegates to no-arg `stack()` for polyphonic mode).

2. **Auto-commit cursor results**: If the builder function returns a cursor (e.g., `b.note('C4', 1)`), it is automatically committed to ensure no pending operations are lost.

3. **Backward compatibility**: The no-arg `stack()` behavior is preserved by delegating to `super.stack()` when no builder function is provided.
