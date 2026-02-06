# Composer Package Remediation Plan

**Date**: 2025-02-06  
**Target Package**: `@symphonyscript/composer`  
**Prerequisite**: Review [001-composer-audit.md](./001-composer-audit.md)

---

## Overview

This plan addresses all issues from the audit. Implementation is ordered by dependency (shared code first, then consumers).

---

## Phase 1: Extract Shared Constants

### Task 1.1: Create `utils/scales.ts`

**File**: `[NEW] packages/composer/src/utils/scales.ts`

Extract `SCALE_INTERVALS` to a shared location:

```typescript
import { ScaleMode } from '../types';

export const SCALE_INTERVALS: Record<ScaleMode, readonly number[]> = {
    major:      [0, 2, 4, 5, 7, 9, 11],
    minor:      [0, 2, 3, 5, 7, 8, 10],
    dorian:     [0, 2, 3, 5, 7, 9, 10],
    phrygian:   [0, 1, 3, 5, 7, 8, 10],
    lydian:     [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    locrian:    [0, 1, 3, 5, 6, 8, 10]
} as const;
```

### Task 1.2: Update Importers

**Files**:
- `[MODIFY] clips/SynapticMelody.ts` — Remove local `SCALE_INTERVALS`, import from `utils/scales`
- `[MODIFY] cursors/SynapticMelodyNoteCursor.ts` — Remove local `SCALE_INTERVALS`, import from `utils/scales`

---

## Phase 2: Implement Arpeggio

### Design: Two-Level Arpeggio System

**Clip-Level (Downstream Mode)** — Sets default for all subsequent chords:
```typescript
melody
  .arpeggio('up')           // Set pattern
  .arpeggioRate(0.125)      // Set rate
  .arpeggioGate(0.8)        // Set gate
  .chord('Cmaj7').commit()  // Played as arpeggio
  .chord('Dm7').commit()    // Also arpeggiated
  .arpeggio(null)           // Turn off
  .chord('G7').commit()     // Block chord
```

**Chord-Level (Per-Chord Override)** — Overrides for one chord:
```typescript
melody
  .chord('Cmaj7')
  .arpeggio('down')         // Override pattern
  .arpeggioRate(0.0625)     // Override rate
  .arpeggioGate(0.9)        // Override gate
  .commit()
```

---

### Task 2.1: Update Clip-Level Arpeggio Methods

**File**: `[MODIFY] clips/SynapticClip.ts`

```typescript
protected arpeggioPattern: ArpPattern | null = null;
protected _arpeggioRate: number = 0.125;   // Default: 32nd note
protected _arpeggioGate: number = 0.8;     // Default: 80% gate

/**
 * Set arpeggio pattern for subsequent chords.
 * Pass null to disable arpeggio mode.
 */
arpeggio(pattern: ArpPattern | null): this {
    this.arpeggioPattern = pattern;
    return this;
}

/**
 * Set arpeggio note rate (duration between arpeggiated notes).
 */
arpeggioRate(rate: number): this {
    this._arpeggioRate = rate;
    return this;
}

/**
 * Set arpeggio gate (note length as fraction of rate).
 */
arpeggioGate(gate: number): this {
    this._arpeggioGate = gate;
    return this;
}

// Getters for chord cursor to read
getArpeggioPattern(): ArpPattern | null { return this.arpeggioPattern; }
getArpeggioRate(): number { return this._arpeggioRate; }
getArpeggioGate(): number { return this._arpeggioGate; }
```

---

### Task 2.2: Add Chord-Level Arpeggio Methods

**File**: `[MODIFY] cursors/SynapticChordCursor.ts`

```typescript
// Per-chord arpeggio state
private _arpPattern: ArpPattern | null = null;
private _arpRate: number | null = null;
private _arpGate: number | null = null;

/**
 * Set arpeggio pattern for THIS chord only.
 */
arpeggio(pattern: ArpPattern | null): this {
    this._arpPattern = pattern;
    return this;
}

/**
 * Set arpeggio rate for THIS chord only.
 */
arpeggioRate(rate: number): this {
    this._arpRate = rate;
    return this;
}

/**
 * Set arpeggio gate for THIS chord only.
 */
arpeggioGate(gate: number): this {
    this._arpGate = gate;
    return this;
}

/**
 * Reset per-chord state after commit.
 */
private resetArpeggioState(): void {
    this._arpPattern = null;
    this._arpRate = null;
    this._arpGate = null;
}
```

---

### Task 2.3: Update Chord Commit with Arpeggio Logic

**File**: `[MODIFY] cursors/SynapticChordCursor.ts`

```typescript
commit(): void {
    if (!this.hasPending) return;

    // Resolve arpeggio settings (chord-level overrides clip-level)
    const pattern = this._arpPattern ?? this.clip.getArpeggioPattern();
    const rate = this._arpRate ?? this.clip.getArpeggioRate();
    const gate = this._arpGate ?? this.clip.getArpeggioGate();

    // Extract pitches from mask
    let mask = this.chordMask;
    let voiceIndex = 0;
    let interval = 0;
    const root = this.chordRoot;

    while (mask !== 0 && voiceIndex < this.maxVoices) {
        if ((mask & 1) === 1) {
            this.pitches[voiceIndex] = root + interval;
            voiceIndex++;
        }
        mask >>>= 1;
        interval++;
    }

    if (pattern !== null && voiceIndex > 0) {
        // ARPEGGIATE: emit notes sequentially
        const orderedPitches = this.applyArpPattern(
            Array.from(this.pitches.subarray(0, voiceIndex)),
            pattern
        );
        const noteDuration = rate * gate;

        for (const pitch of orderedPitches) {
            const sourceId = this.clip.generateSourceId();
            this.clip.flushNote(
                pitch,
                this._velocity,
                noteDuration,
                this.clip.getCurrentTick(),
                this.muted,
                sourceId,
                this.expressionId
            );
            this.clip.advanceTick(rate);
        }
    } else {
        // BLOCK CHORD: emit all notes at same tick
        for (let i = 0; i < voiceIndex; i++) {
            this.sourceIds[i] = this.clip.generateSourceId();
        }
        for (let i = 0; i < voiceIndex; i++) {
            this.clip.flushNote(
                this.pitches[i],
                this._velocity,
                this._duration,
                this.baseTick,
                this.muted,
                this.sourceIds[i],
                this.expressionId
            );
        }
        this.clip.advanceTick(this._duration);
    }

    this.resetArpeggioState();
    this.hasPending = false;
}
```

---

### Task 2.4: Add `applyArpPattern()` to Chord Cursor

**File**: `[MODIFY] cursors/SynapticChordCursor.ts`

```typescript
/**
 * Apply arpeggio pattern to sorted pitches.
 * @internal
 */
private applyArpPattern(pitches: number[], pattern: ArpPattern): number[] {
    const sorted = [...pitches].sort((a, b) => a - b);

    switch (pattern) {
        case 'up': return sorted;
        case 'down': return [...sorted].reverse();
        case 'upDown': {
            const down = [...sorted].reverse().slice(1);
            return [...sorted, ...down];
        }
        case 'downUp': {
            const up = [...sorted].slice(1);
            return [...[...sorted].reverse(), ...up];
        }
        case 'random': {
            // Use clip's seeded RNG for reproducibility
            const shuffled = [...sorted];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            return shuffled;
        }
        case 'converge': {
            const result: number[] = [];
            let left = 0, right = sorted.length - 1;
            while (left <= right) {
                result.push(sorted[left]);
                if (left !== right) result.push(sorted[right]);
                left++; right--;
            }
            return result;
        }
        case 'diverge': {
            const result: number[] = [];
            const mid = Math.floor(sorted.length / 2);
            let left = mid - 1, right = mid;
            if (sorted.length % 2 === 1) {
                result.push(sorted[mid]);
                right = mid + 1;
            }
            while (left >= 0 || right < sorted.length) {
                if (right < sorted.length) result.push(sorted[right++]);
                if (left >= 0) result.push(sorted[left--]);
            }
            return result;
        }
        default: return sorted;
    }
}
```

---

### Task 2.5: Update Escape Methods

**File**: `[MODIFY] cursors/SynapticMelodyNoteCursor.ts`

Update the escape to use new signature:

```typescript
arpeggio(pattern: ArpPattern | null): SynapticClip {
    this.commit();
    return this.clip.arpeggio(pattern);
}
```


---

## Phase 3: Implement Vibrato

### Task 3.1: Define Vibrato Emission Strategy

**Decision**: Vibrato will emit CC1 (Modulation Wheel) automation at note start.

> Alternative: Pitch bend requires continuous events. CC1 is simpler and widely supported.

### Task 3.2: Update `flushNote()` to Emit Vibrato CC

**File**: `[MODIFY] clips/SynapticClip.ts`

In `flushNote()`, after the note is inserted, check vibrato state:

```typescript
flushNote(...): void {
    // ... existing note emission logic ...
    
    // Emit vibrato CC if active
    if (this.vibratoRate > 0 && this.vibratoDepth > 0) {
        // CC1 = Modulation Wheel (0-127)
        const ccValue = Math.round(this.vibratoDepth * 127);
        this.operations.push({
            kind: 'cc',
            controller: 1,  // CC1 = Modulation
            value: ccValue,
            tick: tick
        });
        // Note: Rate could inform a future LFO-based implementation
        // For MVP, depth sets modulation amount, rate is stored for future use
    }
}
```

### Task 3.3: Add `vibratoOff()` Method

**File**: `[MODIFY] clips/SynapticClip.ts`

```typescript
/**
 * Disable vibrato for subsequent notes.
 */
vibratoOff(): this {
    this.vibratoRate = 0;
    this.vibratoDepth = 0;
    return this;
}
```

---

## Phase 4: Deduplicate voiceMovementCost

### Task 4.1: Adapter Function

**File**: `[NEW] clips/SynapticMelody.ts` or `utils/voiceleading.ts`

Instead of duplicating the algorithm, adapt the theory version:

```typescript
import { voiceMovementCost as theoryVoiceMovement, pack } from '@symphonyscript/theory';

/**
 * Calculate voice movement cost between two pitch arrays.
 * Wraps theory package's zero-alloc implementation.
 */
private voiceMovementCost(from: number[], to: number[]): number {
    // Convert pitch arrays to HarmonyMasks (pitch class only)
    const fromMask = pack(from.map(p => (p % 24)));
    const toMask = pack(to.map(p => (p % 24)));
    return theoryVoiceMovement(fromMask, toMask);
}
```

> Note: This loses octave information. If octave-aware comparison is needed, keep local impl but document clearly.

### Task 4.2: Alternative — Keep Octave-Aware Version

If the octave-aware version is intentional (not just pitch class comparison), document it:

```typescript
/**
 * Calculate voice movement cost between two voicings.
 * Unlike theory's HarmonyMask-based version, this operates on absolute pitches
 * to account for octave differences in voice leading.
 * @internal
 */
private voiceMovementCostAbsolute(from: number[], to: number[]): number {
    // ... existing implementation ...
}
```

**Decision Needed**: User should confirm whether octave-aware comparison is required.

---

## Phase 5: Address Minor Issues

### Task 5.1: Remove or Implement Loop Region

**Options**:
1. **Remove**: Delete `loopEnabled`, `loopStart`, `loopEnd`, `setLoopRegion()` if not planned
2. **Implement**: Wire loop region into MockConsumer or Session playback

**Recommendation**: Mark as `@deprecated` for now, defer full implementation.

### Task 5.2: Document Allocation Policy

Add comment header to `SynapticClip.ts`:

```typescript
/**
 * SynapticClip - Base class for musical clip builders.
 * 
 * ALLOCATION POLICY: This class runs on main thread only.
 * Maps, arrays, and object allocation are permitted.
 * KERNEL-SAFE annotations apply only to constants and pure arithmetic.
 */
```

---

## Verification Plan

### Automated Tests

| Test | Command | Covers |
|------|---------|--------|
| Arpeggio expansion | `npm test -- --testPathPatterns Arpeggio` | Task 2.x |
| Vibrato CC emission | Add new test file `Vibrato.test.ts` | Task 3.x |
| Scale intervals import | Existing scale tests pass | Task 1.x |

### New Tests Required

**File**: `[NEW] __tests__/Vibrato.test.ts`

```typescript
describe('vibrato()', () => {
    it('emits CC1 modulation when vibrato is active', () => {
        const melody = new SynapticMelody(mockBridge);
        melody.vibrato(6, 0.5).note('C4', 1).commit();
        
        const clip = melody.build();
        const ccOps = clip.operations.filter(op => op.kind === 'cc');
        
        expect(ccOps.length).toBe(1);
        expect(ccOps[0].controller).toBe(1);
        expect(ccOps[0].value).toBe(64);  // 0.5 * 127 = 63.5 → 64
    });
    
    it('vibratoOff() stops CC emission', () => {
        const melody = new SynapticMelody(mockBridge);
        melody.vibrato(6, 0.5).note('C4', 1).vibratoOff().note('D4', 1).commit();
        
        const clip = melody.build();
        const ccOps = clip.operations.filter(op => op.kind === 'cc');
        
        expect(ccOps.length).toBe(1);  // Only first note has CC
    });
});
```

**Arpeggio Test Updates**:

Existing `Arpeggio.test.ts` should be extended to verify chord arpeggiation via `arpeggio()` method on `SynapticClip`.

### Run Command

```bash
cd packages/composer && npm test
```

All 37 existing test files must continue to pass.

---

## Implementation Order

1. **Phase 1** (5 min) — Extract SCALE_INTERVALS
2. **Phase 3** (15 min) — Implement vibrato (simpler, CC-based)
3. **Phase 2** (30 min) — Implement arpeggio (requires chord cursor changes)
4. **Phase 4** (10 min) — Document or deduplicate voiceMovementCost
5. **Phase 5** (5 min) — Minor cleanup

**Total Estimate**: ~65 minutes

---

## Resolved Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Arpeggio API | Options object: `arpeggio(pattern, { rate?, gate? })` | More explicit than string parsing, keeps call compact |
| Vibrato | **Pitch bend LFO** | More expressive, proper musical vibrato |
| voiceMovementCost | **Keep octave-aware version** | Composer needs absolute pitch comparison for voice leading |
| Loop Region | **Implement fully** | Complete the feature, not deprecate |

---

## Phase 6: Implement Loop Region

### Task 6.1: Define Loop Region Behavior

Loop region defines a section that repeats during playback. When the playhead reaches `loopEnd`, it jumps back to `loopStart`.

**Integration Point**: This affects `MockConsumer` (kernel) and future `Session` playback.

### Task 6.2: Add Loop Metadata to ClipNode

**File**: `[MODIFY] types.ts`

```typescript
export interface ClipNode {
    // ... existing fields ...
    loopRegion?: {
        start: number;  // Start tick
        end: number;    // End tick
        enabled: boolean;
    };
}
```

### Task 6.3: Wire `setLoopRegion()` to ClipNode

**File**: `[MODIFY] clips/SynapticClip.ts`

Update `build()` to include loop region:

```typescript
build(): ClipNode {
    return {
        _version: SCHEMA_VERSION,
        kind: 'clip',
        name: this.clipName,
        operations: this.operations,
        tempo: this.currentTempo,
        timeSignature: [this.timeSignatureNumerator, this.timeSignatureDenominator],
        swing: this.swingAmount,
        groove: this.currentGroove,
        loopRegion: this.loopEnabled ? {
            start: this.loopStart,
            end: this.loopEnd,
            enabled: true
        } : undefined
    };
}
```

### Task 6.4: Update MockConsumer to Respect Loop Region

**File**: `[MODIFY] @symphonyscript/kernel mock-consumer.ts`

In `process()` or equivalent:

```typescript
// After processing current tick
if (this.clipNode.loopRegion?.enabled) {
    if (this.currentTick >= this.clipNode.loopRegion.end) {
        this.currentTick = this.clipNode.loopRegion.start;
    }
}
```

---

## Updated Phase 3: Implement Vibrato (Pitch Bend LFO)

### Task 3.1: Define Vibrato LFO Emission

**File**: `[MODIFY] clips/SynapticClip.ts`

Vibrato generates a series of pitch bend events forming an LFO:

```typescript
/**
 * Emit vibrato pitch bend LFO for a note.
 * @param tick - Note start tick
 * @param duration - Note duration in ticks
 */
private emitVibratoLFO(tick: number, duration: number): void {
    if (this.vibratoRate <= 0 || this.vibratoDepth <= 0) return;
    
    // Rate is Hz (cycles per second), we need cycles per tick
    // Assuming 480 PPQ and 120 BPM: 1 beat = 480 ticks = 0.5 sec
    // For now, use rate as cycles per beat (simpler)
    const cyclesPerBeat = this.vibratoRate;
    const ticksPerCycle = 480 / cyclesPerBeat;  // At PPQ=480
    
    // Depth is semitones, pitch bend is -8192 to +8191 for ±2 semitones (standard)
    const maxBend = Math.round((this.vibratoDepth / 2) * 8192);
    
    // Generate sine wave sample points
    const sampleInterval = Math.max(20, ticksPerCycle / 8);  // 8 samples per cycle min
    
    for (let t = 0; t < duration; t += sampleInterval) {
        const phase = (t / ticksPerCycle) * 2 * Math.PI;
        const bendValue = Math.round(Math.sin(phase) * maxBend);
        
        this.operations.push({
            kind: 'pitchBend',
            value: bendValue,
            tick: tick + t
        });
    }
    
    // Reset pitch bend at end
    this.operations.push({
        kind: 'pitchBend',
        value: 0,
        tick: tick + duration
    });
}
```

### Task 3.2: Call LFO in flushNote()

```typescript
flushNote(...): void {
    // ... existing note emission ...
    
    // Emit vibrato LFO if active
    if (this.vibratoRate > 0 && this.vibratoDepth > 0) {
        this.emitVibratoLFO(tick, duration);
    }
}
```

### Task 3.3: Vibrato Rate/Depth Documentation

```typescript
/**
 * Set vibrato for subsequent notes.
 * Generates pitch bend LFO events.
 * @param rate - Vibrato rate in Hz (cycles per beat, e.g., 5 = 5 cycles per beat)
 * @param depth - Vibrato depth in semitones (e.g., 0.5 = half semitone)
 */
vibrato(rate: number, depth: number): this
```

---

## Updated Verification Plan

### New Tests Required

**File**: `[NEW] __tests__/LoopRegion.test.ts`

```typescript
describe('setLoopRegion()', () => {
    it('includes loop region in built clip', () => {
        const melody = new SynapticMelody(mockBridge);
        melody.setLoopRegion(0, 480);
        
        const clip = melody.build();
        expect(clip.loopRegion).toEqual({
            start: 0,
            end: 480,
            enabled: true
        });
    });
});
```

**File**: `[NEW] __tests__/Vibrato.test.ts`

```typescript
describe('vibrato() with pitch bend LFO', () => {
    it('emits pitch bend events for vibrato', () => {
        const melody = new SynapticMelody(mockBridge);
        melody.vibrato(5, 0.5).note('C4', 480).commit();
        
        const clip = melody.build();
        const bendOps = clip.operations.filter(op => op.kind === 'pitchBend');
        
        expect(bendOps.length).toBeGreaterThan(0);
        // Should have oscillating values
        const values = bendOps.map(op => op.value);
        expect(Math.max(...values)).toBeGreaterThan(0);
        expect(Math.min(...values)).toBeLessThan(0);
    });
    
    it('resets pitch bend at note end', () => {
        const melody = new SynapticMelody(mockBridge);
        melody.vibrato(5, 0.5).note('C4', 480).commit();
        
        const clip = melody.build();
        const bendOps = clip.operations.filter(op => op.kind === 'pitchBend');
        const lastBend = bendOps[bendOps.length - 1];
        
        expect(lastBend.value).toBe(0);  // Reset to center
    });
});
```

---

## Updated Implementation Order

1. **Phase 1** (5 min) — Extract SCALE_INTERVALS
2. **Phase 2** (30 min) — Implement arpeggio with options  
3. **Phase 3** (30 min) — Implement vibrato pitch bend LFO
4. **Phase 4** (5 min) — Document octave-aware voiceMovementCost
5. **Phase 5** (5 min) — Minor cleanup
6. **Phase 6** (20 min) — Implement loop region

**Total Estimate**: ~95 minutes

---

## Sign-off

All decisions resolved. Ready for implementation.

