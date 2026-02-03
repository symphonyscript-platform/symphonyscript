# Implementation Plan: RFC-050 Clip-Mediated Flush Architecture

## Problem Summary

RFC-049 implementation is fundamentally broken. All cursors flush notes directly to `bridge.insertAsync()`, completely bypassing 15+ escape method properties stored in [SynapticClip](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer/src/new/clips/SynapticClip.ts#3-100) (transpose, swing, tempo, CC automation, etc.). This makes all escape methods "ghost code" that appears to work but does nothing.

**Root Cause:** Cursors call `bridge.insertAsync()` directly instead of delegating to clips.

## User Review Required

> [!CAUTION]
> This is a **complete refactor** of the flush architecture. While it fixes fundamental brokenness, it touches 4 cursor files and the base clip class.

> [!IMPORTANT]
> **Breaking Change Potential:** The `flushNote()` signature will become the ONLY legal way to insert notes into the kernel. Direct `bridge.insertAsync()` calls from cursors will be eliminated.

> [!WARNING]
> **Testing Requirement:** This plan includes 4 new tests to **prove** escape methods work. If any test fails, the entire implementation is invalid.

---

## Proposed Changes

### Synaptic Core - Clip Mediator

#### [MODIFY] [SynapticClip.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer/src/new/clips/SynapticClip.ts)

**Add flush mediator methods:**

1. **`flushNote(pitch, velocity, duration, tick, sourceId, expressionId?)`**  
   - Apply `transposeOffset` to pitch
   - Apply `swingAmount` timing transformation (off-beat delay)
   - Call `flushCCAutomation()` to insert pending CC events
   - Call `bridge.insertAsync()` with transformed values
   - **ONLY method allowed to call `bridge.insertAsync()`**

2. **`protected applySwing(tick: number): number`**  
   - Calculate beat phase using tick modulo
   - Apply swing delay to off-beat ticks based on `swingAmount`
   - Zero-allocation (pure math)

3. **`protected flushCCAutomation(tick: number): void`**  
   - Iterate `ccAutomation` Map
   - Insert CC events via `bridge.insertAsync()`
   - Clear Map after flushing

**Lines affected:** ~+70 lines (new methods)

---

### Cursor Refactors

#### [MODIFY] [SynapticMelodyNoteCursor.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer/src/new/cursors/SynapticMelodyNoteCursor.ts#L119-L138)

**Replace [flush()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer/src/new/cursors/SynapticMelodyNoteCursor.ts#119-139) method (line 119-138):**
- **Before:** Calls `this.bridge.insertAsync(...)` directly
- **After:** Calls `this.clip.flushNote(this.pitch, this._velocity, ...)`
- **Impact:** 1 direct `bridge.insertAsync()` call → 0

---

#### [MODIFY] [SynapticChordCursor.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer/src/new/cursors/SynapticChordCursor.ts#L102-L146)

**Replace [flush()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer/src/new/cursors/SynapticMelodyNoteCursor.ts#119-139) method (line 102-146):**
- **Before:** Loop calling `this.bridge.insertAsync(...)` for each voice
- **After:** Loop calling `this.clip.flushNote(pitches[i], ...)` for each voice
- **Impact:** Up to 8 direct `bridge.insertAsync()` calls → 0

---

#### [MODIFY] [SynapticDrumHitCursor.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer/src/new/cursors/SynapticDrumHitCursor.ts#L81-L170)

**Replace [flush()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer/src/new/cursors/SynapticMelodyNoteCursor.ts#119-139) method (line 81-170):**
- **Before:** Multiple `bridge.insertAsync()` calls for flam/drag articulations
- **After:** Multiple `clip.flushNote()` calls with adjusted ticks for grace notes
- **Impact:** 6 direct `bridge.insertAsync()` calls → 0

**Note:** Flam/drag timing offsets MUST be preserved (grace note delay logic).

---

#### [MODIFY] [SynapticNoteCursor.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer/src/new/cursors/SynapticNoteCursor.ts#L45-L61)

**Replace [flush()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer/src/new/cursors/SynapticMelodyNoteCursor.ts#119-139) method (line 45-61):**
- **Before:** Calls `this.bridge.insertAsync(...)` directly
- **After:** Calls `this.clip.flushNote(...)`
- **Impact:** 1 direct `bridge.insertAsync()` call → 0

---

## Verification Plan

### Automated Tests

#### Test 1: Transpose Transformation
**File:** [SynapticMelodyNoteCursor.test.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer/src/new/__tests__/SynapticMelodyNoteCursor.test.ts)

**New test case:**
```typescript
test('transpose() actually modifies pitch in kernel', () => {
    const clip = new MockSynapticClip(mockBridge);
    const cursor = new SynapticMelodyNoteCursor(clip, mockBridge, chordCursor);
    
    cursor.note('C4').transpose(5); // +5 semitones = F4
    cursor.flush();
    
    // Assert: bridge.insertAsync called with pitch 65 (F4), not 60 (C4)
    expect(mockBridge.insertAsync).toHaveBeenCalledWith(
        expect.anything(),
        65, // F4 = C4 + 5
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
    );
});
```

**How to run:** `cd packages/composer && npm test -- SynapticMelodyNoteCursor.test.ts`

---

#### Test 2: Swing Timing Transformation
**File:** [SynapticClip.test.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer/src/__tests__/SynapticClip.test.ts)

**New test case:**
```typescript
test('swing() delays off-beat notes', () => {
    const clip = new TestSynapticClip(mockBridge);
    clip.swing(0.6); // >0.5 = delay off-beats
    
    // On-beat note (tick 0.0)
    clip.flushNote(60, 0.8, 1.0, 0.0, 1);
    expect(mockBridge.insertAsync).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        0.0, // No swing delay for on-beat
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
    );
    
    // Off-beat note (tick 0.5)
    clip.flushNote(62, 0.8, 1.0, 0.5, 2);
    const lastCall = mockBridge.insertAsync.mock.calls[mockBridge.insertAsync.mock.calls.length - 1];
    expect(lastCall[4]).toBeGreaterThan(0.5); // Swing delay applied
});
```

**How to run:** `cd packages/composer && npm test -- SynapticClip.test.ts`

---

#### Test 3: CC Automation Flushing
**File:** [SynapticClip.test.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer/src/__tests__/SynapticClip.test.ts)

**New test case:**
```typescript
test('control() CC automation is flushed to kernel', () => {
    const clip = new TestSynapticClip(mockBridge);
    clip.control(1, 64); // CC#1 (Mod Wheel) = 64
    clip.control(7, 100); // CC#7 (Volume) = 100
    
    clip.flushNote(60, 0.8, 1.0, 0.0, 1);
    
    // Assert: bridge.insertAsync called for CC events
    expect(mockBridge.insertAsync).toHaveBeenCalledWith(
        expect.any(Number), // OPCODE for CC
        1, // CC number
        64, // CC value
        expect.anything(),
        0.0, // tick
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
    );
});
```

**How to run:** `cd packages/composer && npm test -- SynapticClip.test.ts`

---

#### Test 4: Zero Direct Bridge Calls (Regression)
**File:** New file `zero-direct-bridge-calls.test.ts`

**Test:** Use `grep_search` to verify zero `bridge.insertAsync()` calls in cursor [flush()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer/src/new/cursors/SynapticMelodyNoteCursor.ts#119-139) methods.

```bash
rg "this\.bridge\.insertAsync" packages/composer/src/new/cursors/*.ts
# Expected: 0 results
```

**How to run:** `rg "this\.bridge\.insertAsync" packages/composer/src/new/cursors/*.ts` (must exit with code 1 = no matches)

---

#### Test 5: Existing Test Suite (Regression)
**Command:** `cd packages/composer && npm test`

**Expected:** All 108 existing tests pass.

---

## Acceptance Criteria

- [ ] `SynapticClip.flushNote()` implemented with transpose + swing transformations
- [ ] `SynapticClip.flushCCAutomation()` implemented
- [ ] `SynapticClip.applySwing()` implemented (zero-allocation)
- [ ] All 4 cursor types delegate to `clip.flushNote()`  
- [ ] Zero `bridge.insertAsync()` calls in cursor [flush()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer/src/new/cursors/SynapticMelodyNoteCursor.ts#119-139) methods (verified via grep)  
- [ ] 108 existing tests pass  
- [ ] 3+ new tests proving escape methods transform output  
- [ ] Zero new allocations in hot path  

---

**End of Implementation Plan**
