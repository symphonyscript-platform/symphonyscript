# RFC-047 Phase 8 Task 4: Playback Offset - Implementation Plan

**Date**: 2025-12-28T17:41:00+04:00  
**From**: The Engineer  
**To**: The Architect  
**RFC**: 047  
**Document**: 047-69-by-engineer-task4-plan.md

---

## STATUS: AWAITING APPROVAL

---

## Summary

Implement `.playbackOffset(ms)` method for hardware latency compensation by adding `REG.PLAYBACK_OFFSET` constant to kernel SAB layout and corresponding setter methods in both `SiliconBridge` and `SynapticClip`.

---

## SAB Layout Analysis

### Current HDR Structure (from constants.ts lines 162-232)

The Extended Header has a **reserved slot** available:

```
│ 124    │ 31        │ RESERVED_31        │ u32     │ Future use     │
```

**Proposal**: Use `HDR.RESERVED_31` (index 31, byte offset 124) for `PLAYBACK_OFFSET`.

### Memory Map Section (as documented in constants.ts lines 54-152)

Current layout shows:
- Header Region: 0-60 bytes
- Register Bank: 64-88 bytes
- **Extended Header: 92-124 bytes** ← Our target area
- Node Heap: 128+

**Byte offset 124** (i32 index 31) is currently unused and available for playback offset.

---

## Proposed Changes

### Part A: Kernel Changes

#### 1. Add `REG.PLAYBACK_OFFSET` Constant (constants.ts)

**File**: `packages/kernel/src/constants.ts`

**Location**: Replace `RESERVED_31` with `PLAYBACK_OFFSET` (line 219)

**Current** (lines 217-220):
```typescript
  /** [v1.5] Dedicated slot for Atomics.wait() yield coordination */
  YIELD_SLOT: 30,
  /** Reserved for future expansion */
  RESERVED_31: 31,
```

**Proposed**:
```typescript
  /** [v1.5] Dedicated slot for Atomics.wait() yield coordination */
  YIELD_SLOT: 30,
  /** [RFC-047 Phase 8 Task 4] Playback offset in milliseconds for latency compensation */
  PLAYBACK_OFFSET: 31,
```

**Also update memory map documentation** (line 95):
```typescript
│ 124    │ 31        │ PLAYBACK_OFFSET    │ u32     │ Latency (ms)   │
```

#### 2. Add Setter to `SiliconBridge` (silicon-bridge.ts)

**File**: `packages/kernel/src/silicon-bridge.ts`

**Location**: Add method after `getSAB()` (around line 350)

**Proposed method**:
```typescript
/**
 * Set playback offset for hardware latency compensation.
 * 
 * Writes value directly to SAB using Atomics.store for thread-safety.
 * Value is stored in milliseconds and converted to ticks by Audio Worklet.
 * 
 * @param offsetMs - Hardware latency in milliseconds
 */
setPlaybackOffset(offsetMs: number): void {
    // Store as milliseconds (AudioWorklet will convert to ticks using PPQ/BPM)
    Atomics.store(this.sab, HDR.PLAYBACK_OFFSET, offsetMs | 0)
}

/**
 * Get current playback offset.
 * 
 * @returns Playback offset in milliseconds
 */
getPlaybackOffset(): number {
    return Atomics.load(this.sab, HDR.PLAYBACK_OFFSET)
}
```

**Import requirement**: `HDR` is already imported, `PLAYBACK_OFFSET` will be available after Part A.1.

---

### Part B: Composer Changes

#### 3. Add `.playbackOffset()` to `SynapticClip` (SynapticClip.ts)

**File**: `packages/composer/src/SynapticClip.ts`

**Location**: Add method after `.wait()` (around line 240)

**Proposed method**:
```typescript
/**
 * Set playback offset for hardware latency compensation.
 * 
 * Writes latency compensation directly to SAB (global setting).
 * This affects playback timing in the AudioWorklet.
 * 
 * @param offsetMs - Hardware latency in milliseconds (typically 10-50ms)

 * @returns this for fluent chaining
 * 
 * @example
 * clip.playbackOffset(10);  // Compensate for 10ms output latency
 */
playbackOffset(offsetMs: number): this {
    this.bridge.setPlaybackOffset(offsetMs)
    return this
}
```

---

## Unit Conversion Strategy

### Current Approach:Store in **milliseconds** in SAB (line 31/HDR.PLAYBACK_OFFSET).  

**AudioWorklet responsibility**: Convert ms → ticks using formula:  
```
offsetTicks = (offsetMs / 1000) * (BPM / 60) * PPQ
```

**Rationale**:
- Milliseconds are hardware-native (user knows device latency in ms, not ticks)
- Conversion happens in AudioWorklet where PPQ/BPM are already available
- Avoids storing tick values that become stale when tempo changes

---

## Tests to Add

### File: `packages/composer/src/__tests__/timing.test.ts`

Add new describe block after existing `.wait()` tests:

```typescript
describe('.playbackOffset() - Latency Compensation', () => {
    test('.playbackOffset() accepts milliseconds', () => {
        const clip = Clip.clip('LatencyTest');
        clip.playbackOffset(10);
        expect(clip).toBeDefined();
    });

    test('.playbackOffset() returns this for chaining', () => {
        const clip = Clip.clip('ChainTest');
        const result = clip.playbackOffset(15);
        expect(result).toBe(clip);
    });

    test('.playbackOffset() writes to SAB', () => {
        const clip = Clip.clip('SABTest');
        clip.playbackOffset(20);
        
        // Verify value was written to SAB
        const bridge = (clip as any).bridge;
        expect(bridge.getPlaybackOffset()).toBe(20);
    });

    test('.playbackOffset() combines with other timing methods', () => {
        const clip = Clip.clip('CombineTest');
        clip.playbackOffset(10).wait(480).shift(20).note('C4');
        expect(clip).toBeDefined();
    });
});
```

---

## Verification Plan

### Automated Tests

Run:
```bash
cd /Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer
npm run test -- timing.test.ts
```

Expected: All existing tests pass + 4 new playback offset tests pass.

### TypeScript Compilation

Verify both packages compile:
```bash
cd /Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/kernel
npx tsc --noEmit

cd /Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer
npx tsc --noEmit
```

Expected: No type errors.

### SAB Write Verification

Test 3 verifies the round-trip: `.playbackOffset(20)` → `bridge.setPlaybackOffset(20)` → `Atomics.store(sab, 31, 20)` → `bridge.getPlaybackOffset()` returns 20.

---

## Thread Safety

### Atomic Operations

All SAB operations use `Atomics.store` and `Atomics.load` for thread-safe reads/writes:

```typescript
// Write (silicon-bridge.ts)
Atomics.store(this.sab, HDR.PLAYBACK_OFFSET, offsetMs | 0)

// Read (silicon-bridge.ts)
Atomics.load(this.sab, HDR.PLAYBACK_OFFSET)
```

### No Mutex Required

Playback offset is a **global configuration value**, not structural data:
- Writes are atomic (single i32 store)
- No linked-list manipulation
- No coordination with Chain Mutex needed
- Safe to update from Main Thread while AudioWorklet reads

---

## Zero-Allocation Compliance

- ✅ `setPlaybackOffset()` uses only primitives and Atomics
- ✅ `.playbackOffset()` delegates to bridge method (no allocations)
- ✅ Storage in SAB header (pre-allocated)
- ✅ Integer coercion via `| 0` for type safety

---

## Concerns / Questions

**None** - Implementation is straightforward:
1. Repurpose existing `RESERVED_31` slot
2. Add atomic setter/getter to bridge
3. Expose via composer fluent API
4. AudioWorklet converts ms→ticks using existing PPQ/BPM

---

**Awaiting Architect approval to proceed with implementation.**
