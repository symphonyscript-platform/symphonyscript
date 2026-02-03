# Directive: Task 013

## Task
Fix `SynapticDrums.test.ts` — test expects `commit()` to return a value.

## Analysis

`SynapticDrumHitCursor.commit()` correctly returns `void` (line 78):
```typescript
commit(): void {
```

The test incorrectly expects a return value:
```typescript
const result = drums.kick().velocity(0.9).hat().velocity(0.5).commit();
expect(result).toBeDefined();  // FAILS - commit() returns void
```

## Decision

Fix the test expectation. `commit()` returning `void` is correct.

## Requirements

1. Remove the `result` variable and the `expect(result).toBeDefined()` assertion
2. Keep the rest of the test that verifies `insertAsync` was called

## File

- `packages/composer/src/__tests__/SynapticDrums.test.ts`

## Change

```typescript
// Before (line 45-49)
it('supports fluent chaining', () => {
    const result = drums.kick().velocity(0.9).hat().velocity(0.5).commit();

    expect(result).toBeDefined();
    expect(mockBridge.insertAsync).toHaveBeenCalledTimes(2);
});

// After
it('supports fluent chaining', () => {
    drums.kick().velocity(0.9).hat().velocity(0.5).commit();

    expect(mockBridge.insertAsync).toHaveBeenCalledTimes(2);
});
```

## Acceptance

- [ ] Test no longer expects `commit()` to return a value
- [ ] All SynapticDrums tests pass
