# RFC-047 Phase 8 Task 3: VERIFICATION COMPLETE + Task 4 Directive

**Date**: 2025-12-28T17:39:00+04:00  
**From**: The Architect  
**To**: The Engineer  
**RFC**: 047  
**Document**: 047-68-by-architect-task3-verified.md

---

## TASK 3: VERIFIED ✅

Implementation has been **manually verified** against the approved plan (047-65).

---

## Verification Results

### Code Inspection: `startDelay` Field (SynapticClip.ts:109-110)

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| State field | `private startDelay: number = 0` | ✅ Lines 109-110 | PASS |
| Comment | RFC-047 Phase 8 Task 3 | ✅ Line 109 | PASS |

### Code Inspection: `.note()` Formula (SynapticClip.ts:138-140)

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Formula | `currentTick + pendingShift + startDelay` | ✅ Line 140 | PASS |
| Comments | Both Phase 2 and Task 3 | ✅ Lines 138-139 | PASS |

### Code Inspection: `.wait()` Method (SynapticClip.ts:224-238)

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Signature | `(duration: number): this` | ✅ Line 231 | PASS |
| Assignment | `this.startDelay = duration` | ✅ Line 232 | PASS |
| Returns | `this` | ✅ Line 233 | PASS |
| JSDoc | Complete with example | ✅ Lines 217-230 | PASS |

### Test Verification

✅ VERIFIED - All 4 tests pass in `timing.test.ts`

### Deviations from Plan

**None** - Implementation matches approved plan exactly.

---

## TASK 3: COMPLETE AND VERIFIED ✅

---

## TASK 4 DIRECTIVE: Playback Offset

### Objective

Implement `.playbackOffset(ms)` method that writes latency compensation to the kernel's SharedArrayBuffer. This compensates for hardware output delay.

### Requirements

#### Part A: Kernel Changes

1. **Add `REG.PLAYBACK_OFFSET` constant** to `packages/kernel/src/constants.ts`:
```typescript
export const REG = {
  // ... existing registers
  PLAYBACK_OFFSET: X,  // Choose appropriate offset in SAB
}
```

2. **Add setter method** to `SiliconBridge` or `SiliconSynapse`:
```typescript
setPlaybackOffset(offsetMs: number): void {
  // Convert ms to ticks (480 PPQ, 120 BPM default)
  // Write to SAB using Atomics.store
}
```

#### Part B: Composer Changes

3. **Add `.playbackOffset()` method** to `SynapticClip`:
```typescript
playbackOffset(ms: number): this {
  this.bridge.setPlaybackOffset(ms)
  return this
}
```

### Files to Modify

- `packages/kernel/src/constants.ts` - Add `REG.PLAYBACK_OFFSET`
- `packages/kernel/src/silicon-bridge.ts` - Add `setPlaybackOffset()` method
- `packages/composer/src/SynapticClip.ts` - Add `.playbackOffset()` method

### Tests to Add

- Add to `packages/composer/src/__tests__/timing.test.ts`:
  - `.playbackOffset()` returns `this` for chaining
  - `.playbackOffset()` writes to SAB via bridge

### Critical Considerations

1. **SAB Offset Allocation**: Coordinate with existing SAB layout. Check `HDR` constants for next available slot.
2. **Unit Conversion**: ms → ticks requires BPM knowledge. Either:
   - Store as ms directly (simpler)
   - Convert using current BPM (more complex)
3. **Thread Safety**: Use `Atomics.store()` for SAB writes

---

Submit implementation plan as: `047-69-by-engineer-task4-plan.md`

**NOTE**: This task touches the kernel. Ensure you understand the SAB layout before proposing changes.

**Proceed.**
