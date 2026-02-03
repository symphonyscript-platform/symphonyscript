# Theory Package Remediation Plan v3.0

**Status:** DRAFT  
**Date:** 2026-02-01  
**Supersedes:** theory-remediation-plan.md (v2.0)

---

## Revision History

| Rev | Date | Changes |
|-----|------|---------|
| 3.0 | 2026-02-01 | **COMPLETE REWRITE:** Legacy folder is PRESERVED. All modules are PORTED (not deleted). New 24-EDO native modules created in parallel folder structure. |

---

## Executive Summary

**CRITICAL RULE:** The `src/legacy/` folder is **READ-ONLY REFERENCE**. No files may be deleted from legacy. All porting creates NEW files in NEW locations.

| Priority | Tasks | Effort | Risk |
|----------|-------|--------|------|
| P0 (Done) | Jest config fix | 5 min | Low |
| P1 (Done) | Static definitions (chords, scales, pitch) | 5 hrs | Low |
| P2 | Rhythm module (euclidean, quantize, grooves) | 4-6 hrs | Medium |
| P3 | Harmony module (progressions, voice leading, keys) | 6-8 hrs | Medium |
| P4 | Utilities (articulation, duration, MIDI extensions) | 2-3 hrs | Low |

**Total Estimated Effort:** 12-17 hours (remaining)

---

## Architecture: Parallel Structure

```
packages/theory/src/
├── legacy/                    # READ-ONLY REFERENCE (DO NOT DELETE)
│   ├── chords/
│   ├── generators/
│   ├── groove/
│   ├── theory/
│   ├── types/
│   ├── util/
│   └── quantize.ts
│
├── chords/                    # ✅ DONE (P1)
│   ├── definitions.ts         # CHORD masks, CHORD_MAP
│   └── index.ts
│
├── scales/                    # ✅ DONE (P1)
│   ├── scales.ts              # SCALE masks, isInScale(), quantizeToScale()
│   └── index.ts
│
├── pitch/                     # ✅ DONE (P1)
│   ├── pitch.ts               # midiToPitchClass24(), isQuarterTone(), etc.
│   └── index.ts
│
├── rhythm/                    # P2: NEW - Port from legacy
│   ├── euclidean.ts           # Port from legacy/generators/euclidean.ts
│   ├── quantize.ts            # Port from legacy/quantize.ts
│   ├── grooves.ts             # Port from legacy/groove/templates.ts
│   ├── articulation.ts        # Port from legacy/util/articulation.ts
│   ├── duration.ts            # Port from legacy/util/duration.ts
│   └── index.ts
│
├── harmony/                   # P3: NEW - Port from legacy
│   ├── progressions.ts        # Port from legacy/theory/progressions.ts
│   ├── voiceleading.ts        # Port from legacy/theory/voiceleading.ts
│   ├── keys.ts                # Port from legacy/theory/keys.ts
│   └── index.ts
│
├── constants.ts               # INTERVAL constants (existing)
├── packer.ts                  # pack/unpack (existing)
├── types.ts                   # HarmonyMask, Interval24EDO (existing)
└── index.ts                   # Updated exports
```

---

## P0: Build Fix (DONE)

### BUILD-001: Jest Config

**Status:** ✅ COMPLETE

```javascript
// FIXED: packages/theory/jest.config.cjs
const { readFileSync } = require('fs');
```

---

## P1: Static Definitions (DONE)

### REWRITE-001: Chord Definitions
**Status:** ✅ COMPLETE  
- 34 chord types as pre-packed `HarmonyMask`
- 85 symbol mappings in `CHORD_MAP`

### REWRITE-002: Scale Definitions
**Status:** ✅ COMPLETE  
- 22 scale types as pre-packed `HarmonyMask`
- `isInScale()`, `quantizeToScale()` - KERNEL-SAFE
- `getScaleIntervals()` - COMPOSER-ONLY

### REWRITE-003: Pitch Utilities
**Status:** ✅ COMPLETE  
- `midiToPitchClass24()`, `pitchClass24ToMidi()` - KERNEL-SAFE
- `isQuarterTone()`, `roundToSemitone()` - KERNEL-SAFE
- `getIntervalName()`, `getPitchClassName()` - COMPOSER-ONLY

---

## P2: Rhythm Module (TODO)

### PORT-001: Euclidean Rhythm Generator

**Legacy Reference:** `legacy/generators/euclidean.ts`  
**New Location:** `rhythm/euclidean.ts`  
**Effort:** 1.5 hours

**Porting Strategy:**
- Bjorklund algorithm is rhythm-based (not pitch-based) - minimal 24-EDO changes needed
- Add kernel-safe variant using callback pattern
- Add bitmask output variant for integration with `HarmonyMask` operations

**Implementation:**

```typescript
// packages/theory/src/rhythm/euclidean.ts
import type { HarmonyMask } from '../types';
import { asHarmonyMask } from '../types';

/**
 * Bjorklund's algorithm for Euclidean rhythms.
 * COMPOSER-ONLY: Allocates arrays.
 * 
 * @param hits - Number of pulses (k)
 * @param steps - Total steps (n)
 * @returns Boolean array where true = hit
 */
export function euclidean(hits: number, steps: number): boolean[] {
    // [Port existing Bjorklund implementation from legacy]
}

/**
 * Euclidean rhythm as bitmask.
 * KERNEL-SAFE: Returns primitive.
 * 
 * @param hits - Number of pulses
 * @param steps - Total steps (max 24)
 * @returns Bitmask where set bits = hits
 */
export function euclideanMask(hits: number, steps: number): HarmonyMask {
    if (steps > 24) {
        throw new Error('euclideanMask supports max 24 steps (use euclidean() for longer patterns)');
    }
    const pattern = euclidean(hits, steps);
    let mask = 0;
    for (let i = 0; i < pattern.length; i++) {
        if (pattern[i]) mask |= (1 << i);
    }
    return asHarmonyMask(mask);
}

/**
 * Kernel-safe Euclidean iteration.
 * KERNEL-SAFE: Uses callback, no allocation.
 * 
 * @param hits - Number of pulses
 * @param steps - Total steps
 * @param callback - Called for each hit position
 */
export function euclideanForEach(
    hits: number, 
    steps: number, 
    callback: (step: number) => void
): void {
    const mask = euclideanMask(Math.min(hits, 24), Math.min(steps, 24));
    for (let i = 0; i < steps; i++) {
        if ((mask & (1 << (i % 24))) !== 0) {
            callback(i);
        }
    }
}

/**
 * Rotate pattern by offset steps.
 * COMPOSER-ONLY: Allocates new array.
 */
export function rotatePattern(pattern: boolean[], offset: number): boolean[] {
    // [Port from legacy]
}

/**
 * Rotate bitmask pattern.
 * KERNEL-SAFE: Pure bitwise.
 */
export function rotateMask(mask: HarmonyMask, offset: number, steps: number): HarmonyMask {
    const normalized = ((offset % steps) + steps) % steps;
    const shifted = ((mask >> normalized) | (mask << (steps - normalized))) & ((1 << steps) - 1);
    return asHarmonyMask(shifted);
}
```

**Tests Required:**
- `euclidean(3, 8)` = tresillo pattern
- `euclidean(5, 8)` = cinquillo pattern
- `euclideanMask()` matches `euclidean()` as bitmask
- `rotateMask()` matches `rotatePattern()` behavior

---

### PORT-002: Beat-Grid Quantization

**Legacy Reference:** `legacy/quantize.ts`  
**New Location:** `rhythm/quantize.ts`  
**Effort:** 1 hour

**Porting Strategy:**
- Time-based utilities (not pitch-based) - no 24-EDO changes
- All functions are already zero-allocation (arithmetic only)
- Port as-is with improved typing

**Implementation:**

```typescript
// packages/theory/src/rhythm/quantize.ts

export type QuantizeMode = 'bar' | 'beat' | 'off';

/**
 * Time signature info.
 */
export interface TimeSignature {
    readonly beatsPerMeasure: number;
    readonly beatUnit: number;
}

/**
 * Parse time signature string.
 * KERNEL-SAFE: No allocation.
 */
export function parseTimeSignature(sig: `${number}/${number}`): TimeSignature {
    // [Port from legacy]
}

// [Port all other functions from legacy/quantize.ts]
// All are already kernel-safe (pure arithmetic)
```

---

### PORT-003: Groove Templates

**Legacy Reference:** `legacy/groove/templates.ts`  
**New Location:** `rhythm/grooves.ts`  
**Effort:** 1.5 hours

**Porting Strategy:**
- Groove affects timing/velocity (not pitch) - no 24-EDO changes
- Port templates as frozen constants
- Add kernel-safe lookup function

**Implementation:**

```typescript
// packages/theory/src/rhythm/grooves.ts

export interface GrooveStep {
    readonly timing?: number;   // -1.0 to 1.0 offset
    readonly velocity?: number; // 0.0 to 2.0 multiplier
}

export interface GrooveTemplate {
    readonly name: string;
    readonly stepsPerBeat: number;
    readonly steps: readonly GrooveStep[];
}

/**
 * Create MPC-style swing groove.
 * COMPOSER-ONLY: Allocates template object.
 */
export function createSwing(amount: number, stepsPerBeat?: number): GrooveTemplate {
    // [Port from legacy]
}

/**
 * Pre-defined groove templates.
 */
export const GROOVE = {
    STRAIGHT: Object.freeze({ name: 'Straight', stepsPerBeat: 4, steps: [] }),
    MPC_16_55: Object.freeze(createSwing(0.55, 4)),
    MPC_16_57: Object.freeze(createSwing(0.57, 4)),
    MPC_16_60: Object.freeze(createSwing(0.60, 4)),
    MPC_16_66: Object.freeze(createSwing(0.66, 4)),
    MPC_16_75: Object.freeze(createSwing(0.75, 4)),
    SWING: Object.freeze({ name: 'Swing', stepsPerBeat: 2, steps: [{ timing: 0 }, { timing: 0.16 }] }),
    LAID_BACK: Object.freeze({ /* ... */ }),
    RUSHING: Object.freeze({ /* ... */ }),
} as const;

/**
 * Apply groove to a step position.
 * KERNEL-SAFE: No allocation.
 */
export function applyGroove(
    step: number,
    template: GrooveTemplate,
    baseVelocity: number = 1.0
): { timing: number; velocity: number } {
    const idx = step % template.steps.length;
    const grooveStep = template.steps[idx] ?? {};
    return {
        timing: grooveStep.timing ?? 0,
        velocity: baseVelocity * (grooveStep.velocity ?? 1.0)
    };
}
```

---

### PORT-004: Articulation

**Legacy Reference:** `legacy/util/articulation.ts`  
**New Location:** `rhythm/articulation.ts`  
**Effort:** 30 minutes

**Implementation:**

```typescript
// packages/theory/src/rhythm/articulation.ts

export type Articulation = 'staccato' | 'legato' | 'accent' | 'tenuto' | 'marcato';

/**
 * Articulation duration multipliers.
 * KERNEL-SAFE: Frozen constant.
 */
export const ARTICULATION_MULTIPLIER: Readonly<Record<Articulation, number>> = {
    staccato: 0.5,
    legato: 1.05,
    accent: 1.0,
    tenuto: 1.0,
    marcato: 0.75,
};

/**
 * Get duration multiplier for articulation.
 * KERNEL-SAFE: Pure lookup.
 */
export function getArticulationMultiplier(articulation?: Articulation): number {
    return articulation ? (ARTICULATION_MULTIPLIER[articulation] ?? 1.0) : 1.0;
}
```

---

### PORT-005: Duration Utilities

**Legacy Reference:** `legacy/util/duration.ts`  
**New Location:** `rhythm/duration.ts`  
**Effort:** 30 minutes

---

## P3: Harmony Module (TODO)

### PORT-006: Chord Progressions

**Legacy Reference:** `legacy/theory/progressions.ts`  
**New Location:** `harmony/progressions.ts`  
**Effort:** 3 hours

**Porting Strategy:**
- Roman numeral parsing is string-based - minimal changes
- Chord resolution should return `HarmonyMask` instead of string chord codes
- Add kernel-safe progression lookup by index

**Key Changes:**
1. `romanToChord()` → `romanToMask()` returns `HarmonyMask`
2. Scale degree calculations use 24-EDO intervals
3. `PROGRESSION_PRESETS` returns `HarmonyMask[][]` for each key

**Implementation:**

```typescript
// packages/theory/src/harmony/progressions.ts
import type { HarmonyMask, Interval24EDO } from '../types';
import { CHORD, CHORD_MAP } from '../chords';
import { SCALE } from '../scales';
import { INTERVAL } from '../constants';

export interface KeyContext {
    readonly root: Interval24EDO;  // 24-EDO root (0, 2, 4, ... 22)
    readonly mode: 'major' | 'minor';
}

export interface ParsedNumeral {
    readonly degree: number;       // 1-7
    readonly quality: string;      // chord quality suffix
    readonly accidental?: -1 | 1;  // b=-1, #=+1
    readonly secondary?: number;   // secondary target degree
}

/**
 * Parse roman numeral to degree and quality.
 * COMPOSER-ONLY: String parsing.
 */
export function parseRomanNumeral(numeral: string, mode: 'major' | 'minor'): ParsedNumeral {
    // [Port parsing logic from legacy]
}

/**
 * Get chord mask for a scale degree.
 * KERNEL-SAFE: Pure bitwise.
 * 
 * @param degree - Scale degree (1-7)
 * @param key - Key context
 * @returns Transposed chord mask
 */
export function degreeToMask(degree: number, key: KeyContext): HarmonyMask {
    // Get diatonic chord quality for this degree
    const qualities = key.mode === 'major' 
        ? ['maj', 'm', 'm', 'maj', 'maj', 'm', 'dim']
        : ['m', 'dim', 'maj', 'm', 'm', 'maj', 'maj'];
    
    const quality = qualities[(degree - 1) % 7];
    const baseMask = CHORD_MAP.get(quality === 'maj' ? '' : quality) ?? CHORD.MAJ;
    
    // Get scale degree interval
    const scale = key.mode === 'major' ? SCALE.MAJOR : SCALE.MINOR;
    // Calculate transposition from degree...
    
    return transposeMask(baseMask, rootInterval);
}

/**
 * Convert roman numeral to chord mask in key.
 * COMPOSER-ONLY: String parsing.
 */
export function romanToMask(numeral: string, key: KeyContext): HarmonyMask {
    const parsed = parseRomanNumeral(numeral, key.mode);
    return degreeToMask(parsed.degree, key);
}

/**
 * Pre-computed progression presets.
 */
export const PROGRESSION = {
    POP: ['I', 'V', 'vi', 'IV'],
    BLUES_12: ['I', 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'V'],
    JAZZ_II_V_I: ['ii7', 'V7', 'Imaj7'],
    JAZZ_TURNAROUND: ['Imaj7', 'vi7', 'ii7', 'V7'],
    ANDALUSIAN: ['i', 'VII', 'VI', 'V'],
    FIFTIES: ['I', 'vi', 'IV', 'V'],
    PACHELBEL: ['I', 'V', 'vi', 'iii', 'IV', 'I', 'IV', 'V'],
} as const;
```

---

### PORT-007: Voice Leading

**Legacy Reference:** `legacy/theory/voiceleading.ts`  
**New Location:** `harmony/voiceleading.ts`  
**Effort:** 3 hours

**Porting Strategy:**
- Voice leading is pitch-based - needs 24-EDO conversion
- Input/output should use `Interval24EDO` arrays
- Core algorithm (closest voice motion) remains the same

**Implementation:**

```typescript
// packages/theory/src/harmony/voiceleading.ts
import type { HarmonyMask, Interval24EDO } from '../types';
import { unpackToArray } from '../packer';
import { OCTAVE_SIZE } from '../constants';

export interface VoiceLeadOptions {
    readonly voices?: number;     // Default: 4
    readonly style?: 'close' | 'open' | 'drop2';
}

/**
 * Voice lead between two chord masks.
 * COMPOSER-ONLY: Allocates arrays.
 * 
 * @param fromMask - Starting chord
 * @param toMask - Target chord
 * @param options - Voice leading options
 * @returns Array of voice movements (pairs of from/to intervals)
 */
export function voiceLead(
    fromMask: HarmonyMask,
    toMask: HarmonyMask,
    options: VoiceLeadOptions = {}
): Array<{ from: Interval24EDO; to: Interval24EDO }> {
    const fromIntervals = unpackToArray(fromMask);
    const toIntervals = unpackToArray(toMask);
    
    // [Port voice leading algorithm from legacy]
    // Use 24-EDO intervals instead of MIDI numbers
}

/**
 * Calculate total voice movement distance.
 * KERNEL-SAFE: No allocation.
 */
export function voiceMovementCost(
    fromMask: HarmonyMask,
    toMask: HarmonyMask
): number {
    // Iterate through bits and calculate minimal movement
    // [Bitwise implementation]
}

/**
 * Find smoothest voicing for chord progression.
 * COMPOSER-ONLY: Allocates arrays.
 */
export function voiceLeadProgression(
    progression: HarmonyMask[],
    options?: VoiceLeadOptions
): Interval24EDO[][] {
    // [Port from legacy with 24-EDO types]
}
```

---

### PORT-008: Key Signatures

**Legacy Reference:** `legacy/theory/keys.ts`  
**New Location:** `harmony/keys.ts`  
**Effort:** 2 hours

**Porting Strategy:**
- Key signatures use pitch classes - convert to 24-EDO
- Store key signature accidentals as `HarmonyMask` (sharped/flatted notes)
- Add kernel-safe key lookup

---

## P4: Utilities (TODO)

### PORT-009: Extended MIDI Utilities

**Legacy Reference:** `legacy/util/midi.ts` + `legacy/types/midi.ts`  
**New Location:** Extend `pitch/pitch.ts` or create `pitch/midi.ts`  
**Effort:** 1 hour

**Functions to add:**
- `noteToMidi()` - Parse "C4" to MIDI 60 (partially done)
- `midiToNote()` - Convert MIDI 60 to "C4" (need to add)
- `transposeNote()` - Transpose by semitones
- MIDI CC constants
- GM program names
- GM drum map

---

## Summary Table

| ID | Task | Location | Effort | Status |
|----|------|----------|--------|--------|
| BUILD-001 | Jest config fix | jest.config.cjs | 5 min | ✅ DONE |
| REWRITE-001 | Chord definitions | chords/definitions.ts | 2 hr | ✅ DONE |
| REWRITE-002 | Scale definitions | scales/scales.ts | 1.5 hr | ✅ DONE |
| REWRITE-003 | Pitch utilities | pitch/pitch.ts | 1 hr | ✅ DONE |
| PORT-001 | Euclidean rhythm | rhythm/euclidean.ts | 1.5 hr | PENDING |
| PORT-002 | Beat-grid quantize | rhythm/quantize.ts | 1 hr | PENDING |
| PORT-003 | Groove templates | rhythm/grooves.ts | 1.5 hr | PENDING |
| PORT-004 | Articulation | rhythm/articulation.ts | 30 min | PENDING |
| PORT-005 | Duration utilities | rhythm/duration.ts | 30 min | PENDING |
| PORT-006 | Progressions | harmony/progressions.ts | 3 hr | PENDING |
| PORT-007 | Voice leading | harmony/voiceleading.ts | 3 hr | PENDING |
| PORT-008 | Key signatures | harmony/keys.ts | 2 hr | PENDING |
| PORT-009 | MIDI extensions | pitch/midi.ts | 1 hr | PENDING |

---

## Implementation Order

### Session 1: Rhythm Module (P2) — 4-6 hours
1. Create `src/rhythm/` folder structure
2. PORT-001: `euclidean.ts` with `euclideanMask()` variant
3. PORT-002: `quantize.ts` (direct port, already kernel-safe)
4. PORT-003: `grooves.ts` with `GROOVE` constants
5. PORT-004: `articulation.ts` (small, quick port)
6. PORT-005: `duration.ts` (small, quick port)
7. Create `rhythm/index.ts` exports
8. Add tests for rhythm module
9. Update `src/index.ts` to export rhythm

### Session 2: Harmony Module (P3) — 6-8 hours
1. Create `src/harmony/` folder structure
2. PORT-006: `progressions.ts` with `romanToMask()`
3. PORT-007: `voiceleading.ts` with 24-EDO intervals
4. PORT-008: `keys.ts` with `HarmonyMask` accidentals
5. Create `harmony/index.ts` exports
6. Add tests for harmony module
7. Update `src/index.ts` to export harmony

### Session 3: Utilities + Cleanup (P4) — 2-3 hours
1. PORT-009: MIDI extensions
2. Review all exports
3. Final test pass
4. Documentation review

---

## Critical Rules for Engineer

1. **DO NOT DELETE** any file from `src/legacy/`
2. **DO NOT MODIFY** any file in `src/legacy/`
3. Legacy is **READ-ONLY REFERENCE** for porting
4. All new code goes in **NEW FOLDERS** (`rhythm/`, `harmony/`)
5. Each new function must specify: **KERNEL-SAFE** or **COMPOSER-ONLY**
6. Tests must verify new code matches legacy behavior where applicable
7. Legacy folder will be deprecated (not deleted) after all ports are verified

---

## Acceptance Criteria

- [ ] All P2 tasks complete with tests
- [ ] All P3 tasks complete with tests
- [ ] All P4 tasks complete with tests
- [ ] `src/legacy/` folder unchanged (no deletions)
- [ ] `pnpm test` passes (200+ tests)
- [ ] `pnpm build` succeeds
- [ ] All new functions documented with KERNEL-SAFE or COMPOSER-ONLY
