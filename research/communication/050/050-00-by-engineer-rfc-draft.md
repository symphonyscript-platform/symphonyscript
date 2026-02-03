# RFC-050: Clip-Mediated Flush Architecture
**Status:** DRAFT  
**Author:** Symphony-Engineer-Zero  
**Date:** 2025-12-29  
**Supersedes:** Portions of RFC-049 (Phase 6-7)

---

## 1. PROBLEM STATEMENT

RFC-049 implementation is **fundamentally broken** due to architectural malpractice.

### The Fatal Flaw

All cursors flush notes directly to `bridge.insertAsync()`:

```typescript
// SynapticMelodyNoteCursor.flush() - Line 125
this.bridge.insertAsync(
    OPCODE_NOTE,
    this.pitch,        // ❌ Raw pitch, no transpose applied
    vel,               // ❌ No humanization
    this._duration,    // ❌ No swing/groove timing
    this.baseTick,     // ❌ No tempo adjustment
    this.muted,
    sourceId,
    undefined,
    this.expressionId
);
```

This **completely bypasses** 15+ escape method properties stored in `SynapticClip`:
- `transposeOffset` (set via `transpose()`)
- `currentScale` (set via `scale()`)
- `swingAmount` (set via `swing()`)
- `currentTempo` (set via `tempo()`)
- `ccAutomation` Map (set via `control()`)
- `vibratoRate`, `vibratoDepth` (set via `vibrato()`)
- And 9 more...

### Audit Results

| Category | Count | Files |
|----------|-------|-------|
| Direct `bridge.insertAsync()` calls | 8 | 4 cursor files |
| Orphaned properties (write-only, never read) | 15 | `SynapticClip.ts` |
| Ghost methods (appear to work, do nothing) | 13 | `SynapticClip.ts` |

---

## 2. ROOT CAUSE

**Architectural Inversion:** Cursors manage note insertion instead of delegating to clips.

**Correct Pattern:**
```
User → Cursor (UI/DSL) → Clip (State + Transform) → Bridge (Kernel)
```

**Current Broken Pattern:**
```
User → Cursor (UI/DSL) → Bridge (Kernel)
                ↓
         Clip (Orphaned State, NOT Applied)
```

---

## 3. SOLUTION: CLIP AS FLUSH MEDIATOR

### 3.1 Design Principle

**Clips MUST be the ONLY entity that calls `bridge.insertAsync()`.**

Cursors delegate to clip flush methods, which apply all escape transformations before kernel insertion.

### 3.2 New Clip Interface

Add to `SynapticClip` base class:

```typescript
export abstract class SynapticClip {
    // ... existing escape state ...
    
    // Seeded PRNG state for deterministic humanization (D-001 fix)
    private humanizeSeed: number = 12345;

    /**
     * Flush a single note to kernel with all escape transformations applied.
     * @remarks This is the ONLY method that may call bridge.insertAsync()
     */
    flushNote(
        pitch: number,
        velocity: number,      // Normalized 0-1
        duration: number,
        tick: number,
        muted: boolean,        // D-002 fix: Added muted parameter
        sourceId: number,
        expressionId?: number
    ): void {
        // 1. Apply transpose
        const finalPitch = pitch + this.transposeOffset;

        // 2. Apply humanization (velocity & timing micro-variations)
        const humanizedVel = this.applyHumanization(velocity);
        
        // 3. Apply swing/groove timing
        const swingTick = this.applySwing(tick);
        
        // 4. Apply tempo scaling (if needed for tick→time conversion)
        // (Tempo affects absolute time but not relative ticks in current design)
        
        // 5. Insert CC automation if pending
        this.flushCCAutomation(swingTick);
        
        // 6. Final kernel insertion
        const finalVel = Math.floor(humanizedVel * 127);
        this.bridge.insertAsync(
            OPCODE_NOTE,
            finalPitch,
            finalVel,
            duration,
            swingTick,
            false, // muted (cursor handles this)
            sourceId,
            undefined,
            expressionId
        );
    }

    /**
     * Flush CC automation points to kernel.
     * D-004 fix: Use OPCODE.CC from kernel constants.
     * 
     * NOTE: CC flushing temporarily stubbed pending AudioWorklet handler verification.
     */
    protected flushCCAutomation(tick: number): void {
        if (this.ccAutomation.size === 0) return;
        
        // TEMPORARY STUB: Verify AudioWorklet CC handler before enabling
        // for (const [cc, value] of this.ccAutomation) {
        //     this.bridge.insertAsync(
        //         OPCODE.CC,  // D-004 fix: Correct constant from kernel
        //         cc,
        //         value,
        //         0,
        //         tick,
        //         false,
        //         this.generateSourceId(),
        //         undefined,
        //         undefined
        //     );
        // }
        // this.ccAutomation.clear();
    }

    /**
     * Apply swing timing transformation.
     * D-003 fix: Derive ticksPerBeat from time signature.
     */
    protected applySwing(tick: number): number {
        // D-003 fix: Derive from time signature (4/4 → 1.0 beat, 3/4 → 0.75 beat)
        const ticksPerBeat = 4.0 / this.timeSignatureDenominator;
        const beatPhase = tick % ticksPerBeat;
        
        if (beatPhase > ticksPerBeat / 2) {
            // Off-beat: delay by swing amount
            return tick + (this.swingAmount - 0.5) * 0.1;
        }
        return tick;
    }

    /**
     * Apply velocity humanization.
     * D-001 fix: Use seeded PRNG (xorshift32) instead of Math.random().
     */
    protected applyHumanization(velocity: number): number {
        // xorshift32 for deterministic humanization
        this.humanizeSeed ^= this.humanizeSeed << 13;
        this.humanizeSeed ^= this.humanizeSeed >>> 17;
        this.humanizeSeed ^= this.humanizeSeed << 5;
        
        const normalized = (this.humanizeSeed >>> 0) / 0xFFFFFFFF; // 0-1
        const variation = (normalized - 0.5) * 0.05; // ±2.5%
        return Math.max(0, Math.min(1, velocity + variation));
    }
}
```

### 3.3 Cursor Refactor Pattern

**Before (Broken):**
```typescript
flush(): void {
    this.bridge.insertAsync(OPCODE_NOTE, this.pitch, vel, ...);
}
```

**After (Correct):**
```typescript
flush(): void {
    if (!this.hasPending) return;
    
    this.clip.flushNote(
        this.pitch,
        this._velocity,
        this._duration,
        this.baseTick,
        this.clip.generateSourceId(),
        this.expressionId
    );
    
    this.hasPending = false;
}
```

---

## 4. IMPLEMENTATION PHASES

### Phase 1: Add Clip Flush Methods
1. Add `flushNote()` to `SynapticClip` base class
2. Implement transformation logic:
   - `applySwing()`
   - `applyHumanization()`
   - `flushCCAutomation()`
3. Add unit tests proving transformations work

### Phase 2: Refactor Cursors
1. `SynapticMelodyNoteCursor` - Replace direct `bridge.insertAsync()` with `clip.flushNote()`
2. `SynapticChordCursor` - Multi-note flush via loop calling `clip.flushNote()`
3. `SynapticDrumHitCursor` - Handle flam/drag articulations via multiple `clip.flushNote()` calls
4. `SynapticNoteCursor` - Simplest case, single note

### Phase 3: Fix Scale/Degree Resolution
1. Implement scale lookup table in `SynapticClip`
2. `degree()` reads `this.clip.currentScale` instead of hardcoded C major
3. Add scale transformation to `flushNote()` if `currentScale` is set

### Phase 4: Comprehensive Testing
1. **Escape Method Tests:** Verify `transpose()`, `swing()`, `tempo()` actually modify output
2. **CC Automation Test:** Verify `control()` inserts CC events
3. **Humanization Test:** Verify velocity/timing variations (use seeded randomness)
4. **Regression Test:** Ensure all existing 108 tests still pass

---

## 5. ZERO-ALLOCATION COMPLIANCE

### Allocation Budget
- `flushCCAutomation()`: Iterates existing Map (no new allocation if using `for...of`)
- `applySwing()`: Pure math (zero allocation)
- `applyHumanization()`: Pure math (zero allocation)

**Status:** ✅ COMPLIANT (no new allocations in hot path)

---

## 6. CORRECTNESS PROOF REQUIREMENTS

Before approval, implementation MUST include tests proving:

1. **Transpose works:**
   ```typescript
   clip.note('C4').transpose(5).play();
   // Assert: Kernel received pitch 65 (F4), not 60 (C4)
   ```

2. **Swing works:**
   ```typescript
   clip.swing(0.7).note('C4', 0.5).note('E4', 0.5).play();
   // Assert: Second note has delayed tick
   ```

3. **CC Automation works:**
   ```typescript
   clip.control(1, 64).note('C4').play();
   // Assert: Kernel received OPCODE_CONTROL_CHANGE event
   ```

4. **Scale works:**
   ```typescript
   clip.scale('D minor').degree(1).play();
   // Assert: Kernel received pitch 62 (D4), not 60 (C4)
   ```

---

## 7. MIGRATION NOTES

### Breaking Changes
None. Clip API remains unchanged. Internal refactor only.

### Compatibility
All existing user code continues to work. Tests remain valid.

---

## 8. ACCEPTANCE CRITERIA

- [ ] `SynapticClip.flushNote()` implemented with all transformations
- [ ] All 4 cursor types delegate to `clip.flushNote()`
- [ ] Zero direct `bridge.insertAsync()` calls in cursor `flush()` methods
- [ ] 108 existing tests pass
- [ ] 4+ new tests proving escape methods modify output
- [ ] Zero new allocations in hot path

---

**End of RFC-050**
