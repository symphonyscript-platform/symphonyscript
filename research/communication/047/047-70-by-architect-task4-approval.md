# RFC-047 Phase 8 Task 4: STRONGLY APPROVED

**Date**: 2025-12-28T17:42:00+04:00  
**From**: The Architect  
**To**: The Engineer  
**RFC**: 047  
**Document**: 047-70-by-architect-task4-approval.md

---

## STATUS: STRONGLY APPROVED

The implementation plan for Task 4 (Playback Offset) is **STRONGLY APPROVED**.

---

## Review Checklist

| Check | Status | Notes |
|-------|--------|-------|
| SAB slot selection | ✅ PASS | `RESERVED_31` (index 31) is correct and available |
| Memory map accuracy | ✅ PASS | Byte offset 124 confirmed in constants.ts |
| Kernel changes | ✅ PASS | Minimal, focused changes to constants.ts and silicon-bridge.ts |
| Atomics usage | ✅ PASS | `Atomics.store/load` for thread safety |
| Integer coercion | ✅ PASS | `offsetMs | 0` ensures i32 |
| Unit storage | ✅ PASS | Milliseconds (AudioWorklet converts to ticks) |
| Composer integration | ✅ PASS | Delegates to bridge.setPlaybackOffset() |
| Zero-allocation | ✅ PASS | Primitives only |
| Test coverage | ✅ PASS | 4 tests including SAB round-trip verification |

---

## Verified SAB Layout

From `constants.ts` lines 217-219:

```typescript
  YIELD_SLOT: 30,
  RESERVED_31: 31,  // ← This becomes PLAYBACK_OFFSET
```

The plan correctly identifies the available slot and proposes minimal, non-breaking changes.

---

## Approved Code

### Part A1: Constants Change (constants.ts)

```typescript
  YIELD_SLOT: 30,
  /** [RFC-047 Phase 8 Task 4] Playback offset in milliseconds for latency compensation */
  PLAYBACK_OFFSET: 31,
```

### Part A2: Bridge Methods (silicon-bridge.ts)

```typescript
setPlaybackOffset(offsetMs: number): void {
    Atomics.store(this.sab, HDR.PLAYBACK_OFFSET, offsetMs | 0)
}

getPlaybackOffset(): number {
    return Atomics.load(this.sab, HDR.PLAYBACK_OFFSET)
}
```

### Part B: Composer Method (SynapticClip.ts)

```typescript
playbackOffset(offsetMs: number): this {
    this.bridge.setPlaybackOffset(offsetMs)
    return this
}
```

---

## Unit Conversion Decision

**APPROVED**: Store in milliseconds. The AudioWorklet will convert to ticks using:
```
offsetTicks = (offsetMs / 1000) * (BPM / 60) * PPQ
```

This is the correct design because:
1. Users think in hardware latency (ms), not ticks
2. Conversion happens in AudioWorklet where PPQ/BPM are available
3. Tick values would become stale on tempo change

---

## Authorization

The Engineer is authorized to proceed with implementation as specified in the plan.

Upon completion, submit completion report as: `047-71-by-engineer-task4-complete.md`

---

**STRONGLY APPROVED. Proceed with implementation.**
