# RFC-049 ARCHITECTURAL DEFECT REPORT

**Author:** Symphony-Architect-Zero  
**Date:** 2025-12-29  
**Sequence:** 049-35  
**Severity:** CRITICAL  
**Classification:** Broken Implementation  

---

## EXECUTIVE SUMMARY

> [!CAUTION]
> **THE IMPLEMENTATION IS ARCHITECTURALLY BROKEN**

The RFC-049 implementation has a **fundamental design flaw**: Clip state properties are set but **never read**. Cursors bypass clip delegation and communicate with the kernel directly. The entire "escape method" system is a façade—it stores state that is never used.

---

## PART 1: ORPHANED STATE PROPERTIES

Properties in `SynapticClip` that are **SET** but **NEVER READ** by any flush logic:

| # | Property | Setter Method | Read By | Verdict |
|---|----------|---------------|---------|---------|
| 1 | `transposeOffset` | `transpose()` | **NOTHING** | 🔴 ORPHAN |
| 2 | `currentScale` | `scale()` | **NOTHING** | 🔴 ORPHAN |
| 3 | `arpeggioPattern` | `arpeggio()` | **NOTHING** | 🔴 ORPHAN |
| 4 | `vibratoRate` | `vibrato()` | **NOTHING** | 🔴 ORPHAN |
| 5 | `vibratoDepth` | `vibrato()` | **NOTHING** | 🔴 ORPHAN |
| 6 | `currentTempo` | `tempo()` | **NOTHING** | 🔴 ORPHAN |
| 7 | `timeSignatureNumerator` | `timeSignature()` | **NOTHING** | 🔴 ORPHAN |
| 8 | `timeSignatureDenominator` | `timeSignature()` | **NOTHING** | 🔴 ORPHAN |
| 9 | `swingAmount` | `swing()` | **NOTHING** | 🔴 ORPHAN |
| 10 | `currentGroove` | `groove()` | **NOTHING** | 🔴 ORPHAN |
| 11 | `ccAutomation` | `control()` | **NOTHING** | 🔴 ORPHAN |
| 12 | `stackingEnabled` | `stack()` | **NOTHING** | 🔴 ORPHAN |
| 13 | `loopEnabled` | `loop()` | **NOTHING** | 🔴 ORPHAN |
| 14 | `loopStart` | `loop()` | **NOTHING** | 🔴 ORPHAN |
| 15 | `loopEnd` | `loop()` | **NOTHING** | 🔴 ORPHAN |

**Total Orphaned Properties:** 15 / 15 (100%)

---

## PART 2: WRONG FLUSH LOCATION

### Architectural Violation

**RFC Intent:** Clips are live kernel communicators. Cursors are helpers that configure state.

**Current Implementation:** Cursors call `bridge.insertAsync()` directly, bypassing the clip entirely.

### Evidence Matrix

| Cursor | File | Lines | Calls `bridge.insertAsync()` Directly |
|--------|------|-------|---------------------------------------|
| `SynapticNoteCursor` | `SynapticNoteCursor.ts` | 53-63 | ❌ YES (WRONG) |
| `SynapticMelodyNoteCursor` | `SynapticMelodyNoteCursor.ts` | 125-135 | ❌ YES (WRONG) |
| `SynapticChordCursor` | `SynapticChordCursor.ts` | 131-143 | ❌ YES (WRONG) |
| `SynapticDrumHitCursor` | `SynapticDrumHitCursor.ts` | 93-165 | ❌ YES (WRONG) |

### What Should Happen

```typescript
// WRONG (Current)
flush(): void {
    this.bridge.insertAsync(OPCODE_NOTE, pitch, vel, ...);
}

// CORRECT (Required)
flush(): void {
    this.clip.flushNote(this.pitch, this._velocity, this._duration, this.baseTick, ...);
}
```

The clip would then:
1. Apply `transposeOffset` to the pitch
2. Apply `swingAmount` to the timing
3. Apply `humanizeAmount` to velocity/timing
4. Check `currentScale` for pitch correction
5. Emit `ccAutomation` if needed
6. Call `bridge.insertAsync()` with the processed values

---

## PART 3: GHOST METHODS

Methods that **appear functional** but **do nothing useful**:

| Method | File | Line | Ghost Behavior |
|--------|------|------|----------------|
| `tempo()` | `SynapticClip.ts` | 36-38 | Sets `currentTempo` → never used |
| `timeSignature()` | `SynapticClip.ts` | 41-44 | Sets time sig → never used |
| `swing()` | `SynapticClip.ts` | 47-49 | Sets `swingAmount` → never used |
| `groove()` | `SynapticClip.ts` | 52-56 | Sets `currentGroove` → never used |
| `control()` | `SynapticClip.ts` | 59-62 | Sets `ccAutomation` → never flushed |
| `stack()` | `SynapticClip.ts` | 64-67 | Sets `stackingEnabled` → never checked |
| `loop()` | `SynapticClip.ts` | 70-76 | Sets loop bounds → never used |
| `transpose()` | `SynapticClip.ts` | 79-81 | Sets `transposeOffset` → **cursors ignore it** |
| `scale()` | `SynapticClip.ts` | 84-86 | Sets `currentScale` → `degree()` hardcodes C major |
| `arpeggio()` | `SynapticClip.ts` | 89-91 | Sets `arpeggioPattern` → never used |
| `vibrato()` | `SynapticClip.ts` | 94-97 | Sets vibrato params → never used |
| `humanize()` | `SynapticCursor.ts` | 78-82 | Sets `humanizeAmount` → flush ignores it |
| `precise()` | `SynapticCursor.ts` | 85-88 | Resets `humanizeAmount` → flush ignores it |

**Total Ghost Methods:** 13

---

## PART 4: SPECIFIC CODE DEFECTS

### Defect D-001: `degree()` Ignores `currentScale`

**File:** `SynapticMelodyNoteCursor.ts:77-93`

```typescript
degree(deg: number, duration?: number): this {
    // Hardcoded C major scale (limitation: does not use this.clip.currentScale)
    const majorScale = [0, 2, 4, 5, 7, 9, 11]; // ← HARDCODED
    // ...
}
```

**Problem:** Even though `scale('D minor')` sets `this.clip.currentScale`, the `degree()` method completely ignores it and uses hardcoded C major.

---

### Defect D-002: `humanizeAmount` Never Applied

**File:** `SynapticCursor.ts:78-88` (setter) vs all `flush()` methods (no usage)

**Evidence:** The `humanizeAmount` property is set by `humanize()`/`precise()` but **NO flush method** reads or applies it.

```typescript
// humanize() and precise() set this.humanizeAmount
// But flush() never uses it:
flush(): void {
    this.bridge.insertAsync(
        OPCODE_NOTE,
        this.pitch,
        vel,  // ← No humanization applied
        this._duration,
        this.baseTick,  // ← No timing jitter
        // ...
    );
}
```

---

### Defect D-003: `transposeOffset` Never Applied to Pitch

**File:** `SynapticClip.ts:79-81` (setter) vs all cursor `flush()` methods

**Evidence:**
```typescript
// Clip sets:
transpose(semitones: number): this {
    this.transposeOffset = semitones;  // Set
    return this;
}

// But cursor flushes raw pitch:
this.bridge.insertAsync(
    OPCODE_NOTE,
    this.pitch,  // ← Not adjusted by transposeOffset
    // ...
);
```

---

### Defect D-004: `ccAutomation` Never Flushed

**File:** `SynapticClip.ts:59-62`

The Map accumulates CC values but is **never iterated** and **never sent to bridge**.

---

## PART 5: REQUIRED ARCHITECTURAL FIX

### Pattern: Clip-Mediated Flush

#### Step 1: Add Flush Delegation to SynapticClip

```typescript
// SynapticClip.ts - NEW ABSTRACT METHODS
abstract flushNote(
    pitch: number,
    velocity: number,
    duration: number,
    tick: number,
    muted: boolean,
    expressionId?: number
): number; // Returns sourceId

abstract flushDrumHit(
    pitch: number,
    velocity: number,
    duration: number,
    tick: number,
    muted: boolean,
    isFlam: boolean,
    isDrag: boolean
): number;

abstract flushChord(
    pitches: Int32Array,
    voiceCount: number,
    velocity: number,
    duration: number,
    tick: number,
    muted: boolean,
    expressionId?: number
): void;
```

#### Step 2: Implement in Concrete Clips

```typescript
// SynapticMelody.ts
flushNote(pitch: number, velocity: number, ...): number {
    // 1. Apply transpose
    const finalPitch = pitch + this.transposeOffset;
    
    // 2. Apply swing (based on tick position)
    const finalTick = this.applySwing(tick);
    
    // 3. Apply humanization (if cursor passed it)
    // ...
    
    // 4. Emit to bridge
    const sourceId = this.generateSourceId();
    this.bridge.insertAsync(OPCODE_NOTE, finalPitch, ...);
    return sourceId;
}
```

#### Step 3: Refactor Cursor Flush Methods

```typescript
// SynapticMelodyNoteCursor.ts
flush(): void {
    if (!this.hasPending) return;
    
    // DELEGATE to clip (no direct bridge access)
    this.clip.flushNote(
        this.pitch,
        this._velocity,
        this._duration,
        this.baseTick,
        this.muted,
        this.expressionId
    );
    
    this.hasPending = false;
}
```

---

## DISPOSITION

**STATUS:** `FUNDAMENTALLY BROKEN`

This is not a surface-level issue. **100% of escape properties are orphaned**. The entire "clip as kernel communicator" promise is violated. Cursors are acting as independent agents bypassing clip state.

### Required Actions

1. ✗ Add `flushNote()`, `flushDrumHit()`, `flushChord()` abstract methods to `SynapticClip`
2. ✗ Implement flush delegation in `SynapticMelody` and `SynapticDrums`
3. ✗ Refactor all cursor `flush()` methods to delegate to clip
4. ✗ Apply `transposeOffset` in melody flush
5. ✗ Apply `swingAmount` in flush timing calculation
6. ✗ Apply `humanizeAmount` in velocity/timing jitter
7. ✗ Fix `degree()` to read `currentScale` instead of hardcoding C major
8. ✗ Implement `ccAutomation` flush (emit CC events to bridge)
9. ✗ Implement `tempo`/`timeSignature` emission as kernel meta-events

**This requires a new RFC (RFC-050) to define the clip-mediated flush architecture.**

---

**Gatekeeper Signature:** Symphony-Architect-Zero  
**Report Complete:** 2025-12-29T13:45:00+04:00
