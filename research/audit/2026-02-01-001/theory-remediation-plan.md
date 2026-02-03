# THEORY PACKAGE REMEDIATION PLAN

**Package:** `@symphonyscript/theory`  
**Date:** 2026-02-01  
**Audit Reference:** `research/audit/2026-02-01-001/theory-audit.md`  
**Status:** APPROVED (Rev 1.1)

---

## Revision History

| Rev | Date | Changes |
|-----|------|---------|
| 1.0 | 2026-02-01 | Initial plan |
| 1.1 | 2026-02-01 | **Architect Feedback:** Removed RFC-060 references (phantom RFC). MIGRATE-001 reframed as "Legacy Reorganization". TEST-001 effort adjusted from 2-3 hours to 4-6 hours. P2 clarified as optional reorganization. |
| 2.0 | 2026-02-01 | **MAJOR REVISION:** Removed bridge.ts approach entirely. Corrected strategy: Legacy code is REFERENCE ONLY. All modules must be REWRITTEN natively in 24-EDO using RFC-047 bitwise system. Dual variants: zero-alloc for kernel + normal for Composer. |

---

## Executive Summary

| Priority | Findings | Effort | Risk |
|----------|----------|--------|------|
| P0 (Blocker) | 1 | 5 min | Low |
| P1 (Foundation Rewrite) | 4 | 8-10 hours | Medium |
| P2 (Cleanup) | 1 | 30 min | Low |
| P3 (Enhancement) | 4 | 4-6 hours | Low |

**Total Estimated Effort:** 13-17 hours (across multiple sessions)

**CRITICAL STRATEGY NOTE:** Legacy code is REFERENCE ONLY. We do NOT integrate with it or create conversion utilities. All modules are REWRITTEN natively in 24-EDO using the RFC-047 bitwise system.

---

## Phase 0: Unblock (IMMEDIATE)

### BUILD-001: Fix Jest Config

**Priority:** P0 (Blocker)  
**Effort:** 5 minutes  
**Risk:** Low

**Problem:** `jest.config.cjs` uses ES6 `import` in a CommonJS file.

**Fix:**

```javascript
// packages/theory/jest.config.cjs
// BEFORE (broken):
import { readFileSync } from 'fs';

// AFTER (fixed):
const { readFileSync } = require('fs');
```

**Verification:**
```bash
cd packages/theory && pnpm test
```

**Expected Result:** Tests should run (currently 2 test files: `packer.test.ts`, `packer.allocation.test.ts`)

---

## Phase 1: Foundation Rewrite (HIGH PRIORITY)

### CORE STRATEGY: Legacy = Reference, Rewrite in 24-EDO

**IMPORTANT:** The legacy code in `src/legacy/` is **REFERENCE ONLY**. We do NOT integrate with it or create conversion utilities. Instead, we **REWRITE** each module natively using the RFC-047 24-EDO bitwise system.

**Dual Variant Pattern:**
- **Kernel variants** (`*-kernel.ts`): Zero-allocation, callback patterns, no arrays
- **Composer variants** (default): Normal allocation acceptable, arrays OK

---

### REWRITE-001: Chord Definitions (24-EDO Native)

**Priority:** P1  
**Effort:** 2 hours  
**Risk:** Low

**Legacy Reference:** `src/legacy/chords/definitions.ts` (12-TET intervals)

**New Implementation:** `src/chords/definitions.ts` (24-EDO native)

```typescript
// packages/theory/src/chords/definitions.ts
import type { HarmonyMask } from '../types';
import { pack } from '../packer';
import { INTERVAL } from '../constants';

/**
 * RFC-047: Chord definitions using 24-EDO HarmonyMask.
 * Each chord is a pre-computed bitmask for O(1) operations.
 */

export interface ChordDefinition {
    readonly quality: string;
    readonly name: string;
    readonly mask: HarmonyMask;  // Pre-packed 24-EDO bitmask
    readonly codes: readonly string[];  // All valid chord symbols
}

// Pre-computed chord masks (24-EDO native)
export const CHORD = {
    // Major
    MAJ: pack([INTERVAL.UNISON, INTERVAL.MAJOR_THIRD, INTERVAL.PERFECT_FIFTH]),
    MAJ7: pack([INTERVAL.UNISON, INTERVAL.MAJOR_THIRD, INTERVAL.PERFECT_FIFTH, INTERVAL.MAJOR_SEVENTH]),
    MAJ9: pack([INTERVAL.UNISON, INTERVAL.MAJOR_THIRD, INTERVAL.PERFECT_FIFTH, INTERVAL.MAJOR_SEVENTH, INTERVAL.MAJOR_SECOND + 24]),
    
    // Minor
    MIN: pack([INTERVAL.UNISON, INTERVAL.MINOR_THIRD, INTERVAL.PERFECT_FIFTH]),
    MIN7: pack([INTERVAL.UNISON, INTERVAL.MINOR_THIRD, INTERVAL.PERFECT_FIFTH, INTERVAL.MINOR_SEVENTH]),
    MIN9: pack([INTERVAL.UNISON, INTERVAL.MINOR_THIRD, INTERVAL.PERFECT_FIFTH, INTERVAL.MINOR_SEVENTH, INTERVAL.MAJOR_SECOND + 24]),
    
    // Dominant
    DOM7: pack([INTERVAL.UNISON, INTERVAL.MAJOR_THIRD, INTERVAL.PERFECT_FIFTH, INTERVAL.MINOR_SEVENTH]),
    DOM9: pack([INTERVAL.UNISON, INTERVAL.MAJOR_THIRD, INTERVAL.PERFECT_FIFTH, INTERVAL.MINOR_SEVENTH, INTERVAL.MAJOR_SECOND + 24]),
    
    // Diminished
    DIM: pack([INTERVAL.UNISON, INTERVAL.MINOR_THIRD, INTERVAL.TRITONE]),
    DIM7: pack([INTERVAL.UNISON, INTERVAL.MINOR_THIRD, INTERVAL.TRITONE, INTERVAL.MAJOR_SIXTH]),
    HALF_DIM: pack([INTERVAL.UNISON, INTERVAL.MINOR_THIRD, INTERVAL.TRITONE, INTERVAL.MINOR_SEVENTH]),
    
    // Augmented
    AUG: pack([INTERVAL.UNISON, INTERVAL.MAJOR_THIRD, INTERVAL.MINOR_SIXTH]),
    AUG7: pack([INTERVAL.UNISON, INTERVAL.MAJOR_THIRD, INTERVAL.MINOR_SIXTH, INTERVAL.MINOR_SEVENTH]),
    
    // Suspended
    SUS4: pack([INTERVAL.UNISON, INTERVAL.PERFECT_FOURTH, INTERVAL.PERFECT_FIFTH]),
    SUS2: pack([INTERVAL.UNISON, INTERVAL.MAJOR_SECOND, INTERVAL.PERFECT_FIFTH]),
    
    // Power
    POWER: pack([INTERVAL.UNISON, INTERVAL.PERFECT_FIFTH]),
} as const;

/**
 * Chord lookup map: symbol → mask
 */
export const CHORD_MAP: ReadonlyMap<string, HarmonyMask> = new Map([
    // Major
    ['', CHORD.MAJ], ['maj', CHORD.MAJ], ['M', CHORD.MAJ],
    ['maj7', CHORD.MAJ7], ['M7', CHORD.MAJ7], ['Δ', CHORD.MAJ7], ['Δ7', CHORD.MAJ7],
    ['maj9', CHORD.MAJ9], ['M9', CHORD.MAJ9],
    
    // Minor
    ['m', CHORD.MIN], ['-', CHORD.MIN], ['min', CHORD.MIN],
    ['m7', CHORD.MIN7], ['-7', CHORD.MIN7], ['min7', CHORD.MIN7],
    ['m9', CHORD.MIN9], ['-9', CHORD.MIN9],
    
    // Dominant
    ['7', CHORD.DOM7], ['dom7', CHORD.DOM7],
    ['9', CHORD.DOM9], ['dom9', CHORD.DOM9],
    
    // Diminished
    ['dim', CHORD.DIM], ['°', CHORD.DIM],
    ['dim7', CHORD.DIM7], ['°7', CHORD.DIM7],
    ['m7b5', CHORD.HALF_DIM], ['ø', CHORD.HALF_DIM], ['ø7', CHORD.HALF_DIM],
    
    // Augmented
    ['aug', CHORD.AUG], ['+', CHORD.AUG],
    ['aug7', CHORD.AUG7], ['+7', CHORD.AUG7], ['7#5', CHORD.AUG7],
    
    // Suspended
    ['sus4', CHORD.SUS4], ['sus', CHORD.SUS4],
    ['sus2', CHORD.SUS2],
    
    // Power
    ['5', CHORD.POWER],
]);
```

---

### REWRITE-002: Scale Definitions (24-EDO Native)

**Priority:** P1  
**Effort:** 1.5 hours  
**Risk:** Low

**Legacy Reference:** `src/legacy/scales/index.ts` (12-TET)

**New Implementation:** `src/scales/scales.ts` (24-EDO native)

```typescript
// packages/theory/src/scales/scales.ts
import type { HarmonyMask } from '../types';
import { pack } from '../packer';
import { INTERVAL as I } from '../constants';

/**
 * RFC-047: Scale definitions as pre-computed HarmonyMasks.
 */

export const SCALE = {
    // Diatonic Modes
    MAJOR: pack([I.UNISON, I.MAJOR_SECOND, I.MAJOR_THIRD, I.PERFECT_FOURTH, I.PERFECT_FIFTH, I.MAJOR_SIXTH, I.MAJOR_SEVENTH]),
    DORIAN: pack([I.UNISON, I.MAJOR_SECOND, I.MINOR_THIRD, I.PERFECT_FOURTH, I.PERFECT_FIFTH, I.MAJOR_SIXTH, I.MINOR_SEVENTH]),
    PHRYGIAN: pack([I.UNISON, I.MINOR_SECOND, I.MINOR_THIRD, I.PERFECT_FOURTH, I.PERFECT_FIFTH, I.MINOR_SIXTH, I.MINOR_SEVENTH]),
    LYDIAN: pack([I.UNISON, I.MAJOR_SECOND, I.MAJOR_THIRD, I.TRITONE, I.PERFECT_FIFTH, I.MAJOR_SIXTH, I.MAJOR_SEVENTH]),
    MIXOLYDIAN: pack([I.UNISON, I.MAJOR_SECOND, I.MAJOR_THIRD, I.PERFECT_FOURTH, I.PERFECT_FIFTH, I.MAJOR_SIXTH, I.MINOR_SEVENTH]),
    MINOR: pack([I.UNISON, I.MAJOR_SECOND, I.MINOR_THIRD, I.PERFECT_FOURTH, I.PERFECT_FIFTH, I.MINOR_SIXTH, I.MINOR_SEVENTH]),
    LOCRIAN: pack([I.UNISON, I.MINOR_SECOND, I.MINOR_THIRD, I.PERFECT_FOURTH, I.TRITONE, I.MINOR_SIXTH, I.MINOR_SEVENTH]),
    
    // Harmonic/Melodic Minor
    HARMONIC_MINOR: pack([I.UNISON, I.MAJOR_SECOND, I.MINOR_THIRD, I.PERFECT_FOURTH, I.PERFECT_FIFTH, I.MINOR_SIXTH, I.MAJOR_SEVENTH]),
    MELODIC_MINOR: pack([I.UNISON, I.MAJOR_SECOND, I.MINOR_THIRD, I.PERFECT_FOURTH, I.PERFECT_FIFTH, I.MAJOR_SIXTH, I.MAJOR_SEVENTH]),
    
    // Pentatonic
    PENTATONIC_MAJOR: pack([I.UNISON, I.MAJOR_SECOND, I.MAJOR_THIRD, I.PERFECT_FIFTH, I.MAJOR_SIXTH]),
    PENTATONIC_MINOR: pack([I.UNISON, I.MINOR_THIRD, I.PERFECT_FOURTH, I.PERFECT_FIFTH, I.MINOR_SEVENTH]),
    BLUES: pack([I.UNISON, I.MINOR_THIRD, I.PERFECT_FOURTH, I.TRITONE, I.PERFECT_FIFTH, I.MINOR_SEVENTH]),
    
    // Symmetric
    CHROMATIC: pack([I.UNISON, I.MINOR_SECOND, I.MAJOR_SECOND, I.MINOR_THIRD, I.MAJOR_THIRD, I.PERFECT_FOURTH, I.TRITONE, I.PERFECT_FIFTH, I.MINOR_SIXTH, I.MAJOR_SIXTH, I.MINOR_SEVENTH, I.MAJOR_SEVENTH]),
    WHOLE_TONE: pack([I.UNISON, I.MAJOR_SECOND, I.MAJOR_THIRD, I.TRITONE, I.MINOR_SIXTH, I.MINOR_SEVENTH]),
    DIMINISHED_HW: pack([I.UNISON, I.MINOR_SECOND, I.MINOR_THIRD, I.MAJOR_THIRD, I.TRITONE, I.PERFECT_FIFTH, I.MAJOR_SIXTH, I.MINOR_SEVENTH]),
    DIMINISHED_WH: pack([I.UNISON, I.MAJOR_SECOND, I.MINOR_THIRD, I.PERFECT_FOURTH, I.TRITONE, I.MINOR_SIXTH, I.MAJOR_SIXTH, I.MAJOR_SEVENTH]),
} as const;

/**
 * Zero-allocation scale membership test.
 * @param scaleMask - Scale as HarmonyMask
 * @param interval - Interval to test (24-EDO)
 * @returns true if interval is in scale
 */
export function isInScale(scaleMask: HarmonyMask, interval: number): boolean {
    const normalized = ((interval % 24) + 24) % 24;
    return (scaleMask & (1 << normalized)) !== 0;
}

/**
 * Zero-allocation: quantize interval to nearest scale degree.
 * @param scaleMask - Scale as HarmonyMask  
 * @param interval - Interval to quantize (24-EDO)
 * @returns Nearest scale degree
 */
export function quantizeToScale(scaleMask: HarmonyMask, interval: number): number {
    const normalized = ((interval % 24) + 24) % 24;
    
    // Check if already in scale
    if ((scaleMask & (1 << normalized)) !== 0) {
        return normalized;
    }
    
    // Search outward for nearest scale degree
    for (let offset = 1; offset <= 12; offset++) {
        const below = ((normalized - offset) % 24 + 24) % 24;
        const above = (normalized + offset) % 24;
        
        if ((scaleMask & (1 << below)) !== 0) return below;
        if ((scaleMask & (1 << above)) !== 0) return above;
    }
    
    return normalized; // Fallback (shouldn't happen with valid scale)
}
```

---

### REWRITE-003: Pitch Utilities (24-EDO Native)

**Priority:** P1  
**Effort:** 1 hour  
**Risk:** Low

**New Implementation:** `src/pitch/pitch.ts`

```typescript
// packages/theory/src/pitch/pitch.ts
import type { Interval24EDO } from '../types';
import { asInterval24EDO } from '../types';

/**
 * RFC-047: Pitch utilities for 24-EDO system.
 */

/**
 * Convert MIDI note to 24-EDO pitch class.
 * MIDI semitone × 2 = 24-EDO interval (no quarter tones from MIDI)
 */
export function midiToPitchClass24(midi: number): Interval24EDO {
    const semitone = ((midi % 12) + 12) % 12;
    return asInterval24EDO(semitone * 2);
}

/**
 * Convert 24-EDO pitch class to MIDI semitone.
 * Rounds down (quarter tones become natural).
 */
export function pitchClass24ToMidi(interval: Interval24EDO): number {
    return Math.floor(Number(interval) / 2);
}

/**
 * Check if 24-EDO interval is a quarter tone.
 */
export function isQuarterTone(interval: Interval24EDO): boolean {
    return Number(interval) % 2 === 1;
}

/**
 * Get interval name (24-EDO aware).
 */
export function getIntervalName(interval: Interval24EDO): string {
    const names: Record<number, string> = {
        0: 'P1', 1: 'P1+', 2: 'm2', 3: 'm2+', 4: 'M2', 5: 'M2+',
        6: 'm3', 7: 'm3+', 8: 'M3', 9: 'M3+', 10: 'P4', 11: 'P4+',
        12: 'TT', 13: 'TT+', 14: 'P5', 15: 'P5+', 16: 'm6', 17: 'm6+',
        18: 'M6', 19: 'M6+', 20: 'm7', 21: 'm7+', 22: 'M7', 23: 'M7+',
    };
    return names[Number(interval) % 24] ?? '?';
}
```

---

### TEST-001: Tests for New 24-EDO Modules

**Priority:** P1  
**Effort:** 4-6 hours  
**Risk:** Low

**Problem:** New modules need comprehensive test coverage.

**Solution:** Create test files for the new 24-EDO native modules.

**Test Files to Create:**

1. `src/__tests__/chords.test.ts` - Chord definitions and lookup
2. `src/__tests__/scales.test.ts` - Scale definitions and quantization
3. `src/__tests__/pitch.test.ts` - Pitch utilities

**Example: `src/__tests__/chords.test.ts`**

```typescript
import { CHORD, CHORD_MAP } from '../chords/definitions';
import { unpackToArray } from '../packer';
import { INTERVAL } from '../constants';

describe('24-EDO Chord Definitions', () => {
    test('CHORD.MAJ contains correct intervals', () => {
        const intervals = unpackToArray(CHORD.MAJ).map(Number);
        expect(intervals).toEqual([
            INTERVAL.UNISON,
            INTERVAL.MAJOR_THIRD,
            INTERVAL.PERFECT_FIFTH
        ]);
    });

    test('CHORD.MIN contains minor third', () => {
        const intervals = unpackToArray(CHORD.MIN).map(Number);
        expect(intervals).toContain(INTERVAL.MINOR_THIRD);
        expect(intervals).not.toContain(INTERVAL.MAJOR_THIRD);
    });

    test('CHORD.DOM7 contains minor seventh', () => {
        const intervals = unpackToArray(CHORD.DOM7).map(Number);
        expect(intervals).toContain(INTERVAL.MINOR_SEVENTH);
        expect(intervals).not.toContain(INTERVAL.MAJOR_SEVENTH);
    });

    test('CHORD_MAP lookup works for all common symbols', () => {
        expect(CHORD_MAP.get('')).toBe(CHORD.MAJ);
        expect(CHORD_MAP.get('m')).toBe(CHORD.MIN);
        expect(CHORD_MAP.get('7')).toBe(CHORD.DOM7);
        expect(CHORD_MAP.get('dim')).toBe(CHORD.DIM);
        expect(CHORD_MAP.get('aug')).toBe(CHORD.AUG);
    });

    test('CHORD_MAP handles alternate symbols', () => {
        expect(CHORD_MAP.get('-')).toBe(CHORD.MIN);
        expect(CHORD_MAP.get('°')).toBe(CHORD.DIM);
        expect(CHORD_MAP.get('+')).toBe(CHORD.AUG);
        expect(CHORD_MAP.get('Δ7')).toBe(CHORD.MAJ7);
        expect(CHORD_MAP.get('ø')).toBe(CHORD.HALF_DIM);
    });
});
```

**Example: `src/__tests__/scales.test.ts`**

```typescript
import { SCALE, isInScale, quantizeToScale } from '../scales/scales';
import { INTERVAL } from '../constants';
import { countBits } from '../packer';

describe('24-EDO Scale Definitions', () => {
    test('SCALE.MAJOR has 7 notes', () => {
        expect(countBits(SCALE.MAJOR)).toBe(7);
    });

    test('SCALE.PENTATONIC_MAJOR has 5 notes', () => {
        expect(countBits(SCALE.PENTATONIC_MAJOR)).toBe(5);
    });

    test('SCALE.CHROMATIC has 12 notes', () => {
        expect(countBits(SCALE.CHROMATIC)).toBe(12);
    });

    test('SCALE.WHOLE_TONE has 6 notes', () => {
        expect(countBits(SCALE.WHOLE_TONE)).toBe(6);
    });
});

describe('isInScale', () => {
    test('major third is in major scale', () => {
        expect(isInScale(SCALE.MAJOR, INTERVAL.MAJOR_THIRD)).toBe(true);
    });

    test('minor third is NOT in major scale', () => {
        expect(isInScale(SCALE.MAJOR, INTERVAL.MINOR_THIRD)).toBe(false);
    });

    test('tritone is NOT in major scale', () => {
        expect(isInScale(SCALE.MAJOR, INTERVAL.TRITONE)).toBe(false);
    });

    test('tritone IS in blues scale', () => {
        expect(isInScale(SCALE.BLUES, INTERVAL.TRITONE)).toBe(true);
    });
});

describe('quantizeToScale', () => {
    test('in-scale note returns unchanged', () => {
        expect(quantizeToScale(SCALE.MAJOR, INTERVAL.MAJOR_THIRD)).toBe(INTERVAL.MAJOR_THIRD);
    });

    test('minor third quantizes to major second or major third', () => {
        const result = quantizeToScale(SCALE.MAJOR, INTERVAL.MINOR_THIRD);
        // Should snap to nearest: M2 (4) or M3 (8), m3 is 6
        expect([INTERVAL.MAJOR_SECOND, INTERVAL.MAJOR_THIRD]).toContain(result);
    });

    test('quarter tone quantizes to nearest semitone', () => {
        const result = quantizeToScale(SCALE.MAJOR, INTERVAL.MAJOR_THIRD_QS);
        // M3+ (9) should snap to M3 (8) or P4 (10)
        expect([INTERVAL.MAJOR_THIRD, INTERVAL.PERFECT_FOURTH]).toContain(result);
    });
});
```

**Example: `src/__tests__/pitch.test.ts`**

```typescript
import { midiToPitchClass24, pitchClass24ToMidi, isQuarterTone, getIntervalName } from '../pitch/pitch';
import { INTERVAL } from '../constants';

describe('Pitch Utilities', () => {
    test('midiToPitchClass24: C (0) → 0', () => {
        expect(midiToPitchClass24(60)).toBe(0);  // Middle C
    });

    test('midiToPitchClass24: E (4) → 8', () => {
        expect(midiToPitchClass24(64)).toBe(INTERVAL.MAJOR_THIRD);
    });

    test('pitchClass24ToMidi: round-trip', () => {
        const midi = 64;  // E4
        const edo = midiToPitchClass24(midi);
        const backToMidi = pitchClass24ToMidi(edo);
        expect(backToMidi).toBe(4);  // Pitch class only
    });

    test('isQuarterTone: even intervals are not quarter tones', () => {
        expect(isQuarterTone(INTERVAL.MAJOR_THIRD)).toBe(false);
        expect(isQuarterTone(INTERVAL.PERFECT_FIFTH)).toBe(false);
    });

    test('isQuarterTone: odd intervals are quarter tones', () => {
        expect(isQuarterTone(INTERVAL.QUARTER_SHARP)).toBe(true);
        expect(isQuarterTone(INTERVAL.MAJOR_THIRD_QS)).toBe(true);
    });

    test('getIntervalName returns correct names', () => {
        expect(getIntervalName(INTERVAL.UNISON)).toBe('P1');
        expect(getIntervalName(INTERVAL.MAJOR_THIRD)).toBe('M3');
        expect(getIntervalName(INTERVAL.PERFECT_FIFTH)).toBe('P5');
        expect(getIntervalName(INTERVAL.QUARTER_SHARP)).toBe('P1+');
    });
});
```

---

## Phase 2: Legacy Cleanup

### MIGRATE-001: Delete Legacy Folder

**Priority:** P2  
**Effort:** 30 minutes  
**Risk:** Low

**Problem:** Legacy folder served as reference for rewrite. Now that new 24-EDO native modules exist, legacy is dead code.

**Solution:** Delete the entire `legacy/` folder.

```bash
rm -rf packages/theory/src/legacy
```

**Verification:**
- Ensure no imports reference `legacy/` paths
- Run `pnpm build` to verify
- Run `pnpm test` to ensure tests pass

**NOTE:** Legacy code is NOT migrated or moved - it is REPLACED by the new 24-EDO native implementations. The legacy folder was only used as a reference during the rewrite process.

---

### ALLOC-001 & ALLOC-002: Zero-Allocation (RESOLVED)

**Status:** WONTFIX (by design)

**Resolution:** The new 24-EDO native modules follow the **Dual Variant Pattern**:

1. **Kernel-safe functions** (zero-allocation):
   - `isInScale(mask, interval)` - bitwise test, no allocation
   - `quantizeToScale(mask, interval)` - returns number, no allocation
   - `unpack(mask, callback)` - callback pattern, no allocation

2. **Composer-friendly APIs** (allocation OK):
   - `unpackToArray(mask)` - returns array for convenience
   - `CHORD_MAP` - uses Map for O(1) lookup
   - Any function that returns objects/arrays

**Documentation Pattern:**
```typescript
/**
 * Zero-allocation scale membership test.
 * KERNEL-SAFE: No allocation, pure bitwise.
 */
export function isInScale(scaleMask: HarmonyMask, interval: number): boolean {
    // ...
}

/**
 * Get all intervals in scale as array.
 * COMPOSER-ONLY: Allocates array. Do not use in Audio Worklet.
 */
export function getScaleIntervals(scaleMask: HarmonyMask): Interval24EDO[] {
    // ...
}
```

Legacy allocation issues (voice leading, euclidean) are moot - these modules are being REPLACED, not migrated.

---

## Phase 3: Enhancement (LOW PRIORITY)

### THEORY-008: MIDI Constants (HIGH within LOW)

**Priority:** P3 (first)  
**Effort:** 1 hour  
**Risk:** Low

**Solution:** Create `src/pitch/midi-constants.ts`

```typescript
// packages/theory/src/pitch/midi-constants.ts

/**
 * MIDI Control Change Numbers
 */
export const CC = {
    BANK_SELECT: 0,
    MOD_WHEEL: 1,
    BREATH: 2,
    FOOT: 4,
    PORTAMENTO_TIME: 5,
    DATA_ENTRY: 6,
    VOLUME: 7,
    BALANCE: 8,
    PAN: 10,
    EXPRESSION: 11,
    SUSTAIN: 64,
    PORTAMENTO: 65,
    SOSTENUTO: 66,
    SOFT_PEDAL: 67,
    LEGATO: 68,
    HOLD_2: 69,
    // Sound controllers
    SOUND_VARIATION: 70,
    TIMBRE: 71,
    RELEASE_TIME: 72,
    ATTACK_TIME: 73,
    BRIGHTNESS: 74,
    // Effects
    REVERB: 91,
    TREMOLO: 92,
    CHORUS: 93,
    DETUNE: 94,
    PHASER: 95,
    // Channel mode
    ALL_SOUND_OFF: 120,
    RESET_ALL: 121,
    LOCAL_CONTROL: 122,
    ALL_NOTES_OFF: 123,
    OMNI_OFF: 124,
    OMNI_ON: 125,
    MONO_MODE: 126,
    POLY_MODE: 127,
} as const;

/**
 * General MIDI Program Numbers (0-indexed)
 */
export const GM_PROGRAM = {
    // Piano
    ACOUSTIC_GRAND: 0,
    BRIGHT_ACOUSTIC: 1,
    ELECTRIC_GRAND: 2,
    HONKY_TONK: 3,
    ELECTRIC_PIANO_1: 4,
    ELECTRIC_PIANO_2: 5,
    HARPSICHORD: 6,
    CLAVINET: 7,
    // Chromatic Percussion
    CELESTA: 8,
    GLOCKENSPIEL: 9,
    MUSIC_BOX: 10,
    VIBRAPHONE: 11,
    MARIMBA: 12,
    XYLOPHONE: 13,
    TUBULAR_BELLS: 14,
    DULCIMER: 15,
    // Organ
    DRAWBAR_ORGAN: 16,
    PERCUSSIVE_ORGAN: 17,
    ROCK_ORGAN: 18,
    CHURCH_ORGAN: 19,
    REED_ORGAN: 20,
    ACCORDION: 21,
    HARMONICA: 22,
    TANGO_ACCORDION: 23,
    // Guitar
    ACOUSTIC_GUITAR_NYLON: 24,
    ACOUSTIC_GUITAR_STEEL: 25,
    ELECTRIC_GUITAR_JAZZ: 26,
    ELECTRIC_GUITAR_CLEAN: 27,
    ELECTRIC_GUITAR_MUTED: 28,
    OVERDRIVEN_GUITAR: 29,
    DISTORTION_GUITAR: 30,
    GUITAR_HARMONICS: 31,
    // Bass
    ACOUSTIC_BASS: 32,
    ELECTRIC_BASS_FINGER: 33,
    ELECTRIC_BASS_PICK: 34,
    FRETLESS_BASS: 35,
    SLAP_BASS_1: 36,
    SLAP_BASS_2: 37,
    SYNTH_BASS_1: 38,
    SYNTH_BASS_2: 39,
    // Strings
    VIOLIN: 40,
    VIOLA: 41,
    CELLO: 42,
    CONTRABASS: 43,
    TREMOLO_STRINGS: 44,
    PIZZICATO_STRINGS: 45,
    ORCHESTRAL_HARP: 46,
    TIMPANI: 47,
    // ... (continue for all 128)
} as const;

/**
 * General MIDI Drum Map (Channel 10)
 * Note numbers for standard drum kit.
 */
export const GM_DRUM = {
    ACOUSTIC_BASS: 35,
    BASS_1: 36,
    SIDE_STICK: 37,
    ACOUSTIC_SNARE: 38,
    HAND_CLAP: 39,
    ELECTRIC_SNARE: 40,
    LOW_FLOOR_TOM: 41,
    CLOSED_HI_HAT: 42,
    HIGH_FLOOR_TOM: 43,
    PEDAL_HI_HAT: 44,
    LOW_TOM: 45,
    OPEN_HI_HAT: 46,
    LOW_MID_TOM: 47,
    HI_MID_TOM: 48,
    CRASH_1: 49,
    HIGH_TOM: 50,
    RIDE_1: 51,
    CHINESE_CYMBAL: 52,
    RIDE_BELL: 53,
    TAMBOURINE: 54,
    SPLASH: 55,
    COWBELL: 56,
    CRASH_2: 57,
    VIBRASLAP: 58,
    RIDE_2: 59,
    HI_BONGO: 60,
    LOW_BONGO: 61,
    MUTE_HI_CONGA: 62,
    OPEN_HI_CONGA: 63,
    LOW_CONGA: 64,
    HIGH_TIMBALE: 65,
    LOW_TIMBALE: 66,
    HIGH_AGOGO: 67,
    LOW_AGOGO: 68,
    CABASA: 69,
    MARACAS: 70,
    SHORT_WHISTLE: 71,
    LONG_WHISTLE: 72,
    SHORT_GUIRO: 73,
    LONG_GUIRO: 74,
    CLAVES: 75,
    HI_WOOD_BLOCK: 76,
    LOW_WOOD_BLOCK: 77,
    MUTE_CUICA: 78,
    OPEN_CUICA: 79,
    MUTE_TRIANGLE: 80,
    OPEN_TRIANGLE: 81,
} as const;
```

---

### THEORY-001: Interval Theory

**Priority:** P3  
**Effort:** 2 hours

**Solution:** Create `src/pitch/intervals.ts`

```typescript
// packages/theory/src/pitch/intervals.ts

/**
 * Interval quality based on semitone count and generic interval.
 */
export type IntervalQuality = 'P' | 'M' | 'm' | 'A' | 'd' | 'AA' | 'dd';

/**
 * Calculate interval quality.
 * 
 * @param semitones - Number of semitones
 * @param generic - Generic interval (1=unison, 2=second, 3=third, etc.)
 * @returns Interval quality
 */
export function getIntervalQuality(semitones: number, generic: number): IntervalQuality {
    // Perfect intervals: 1, 4, 5, 8
    const perfectIntervals = [1, 4, 5, 8];
    const isPerfect = perfectIntervals.includes(((generic - 1) % 7) + 1);

    // Expected semitones for each generic interval (major/perfect)
    const expected: Record<number, number> = {
        1: 0,   // Unison
        2: 2,   // Major 2nd
        3: 4,   // Major 3rd
        4: 5,   // Perfect 4th
        5: 7,   // Perfect 5th
        6: 9,   // Major 6th
        7: 11,  // Major 7th
        8: 12,  // Octave
    };

    const base = ((generic - 1) % 7) + 1;
    const octaves = Math.floor((generic - 1) / 7);
    const normalizedSemitones = semitones - (octaves * 12);
    const diff = normalizedSemitones - expected[base];

    if (isPerfect) {
        if (diff === 0) return 'P';
        if (diff === 1) return 'A';
        if (diff === -1) return 'd';
        if (diff === 2) return 'AA';
        if (diff === -2) return 'dd';
    } else {
        if (diff === 0) return 'M';
        if (diff === -1) return 'm';
        if (diff === 1) return 'A';
        if (diff === -2) return 'd';
    }

    return diff > 0 ? 'A' : 'd';
}

/**
 * Invert an interval (e.g., M3 → m6).
 */
export function invertInterval(semitones: number): number {
    return 12 - (semitones % 12);
}

/**
 * Check if two intervals are enharmonically equivalent.
 */
export function isEnharmonic(a: number, b: number): boolean {
    return ((a % 12) + 12) % 12 === ((b % 12) + 12) % 12;
}
```

---

### THEORY-003: Advanced Scales

**Priority:** P3  
**Effort:** 1 hour

**Solution:** Extend `src/scales/scales.ts`

```typescript
// Add to existing SCALE_INTERVALS

// Melodic Minor Modes
melodicMinor: [0, 2, 3, 5, 7, 9, 11],
dorianB2: [0, 1, 3, 5, 7, 9, 10],      // Mode 2
lydianAugmented: [0, 2, 4, 6, 8, 9, 11], // Mode 3
lydianDominant: [0, 2, 4, 6, 7, 9, 10],  // Mode 4 (Overtone)
mixolydianB6: [0, 2, 4, 5, 7, 8, 10],    // Mode 5
locrianNat2: [0, 2, 3, 5, 6, 8, 10],     // Mode 6 (Half-Diminished)
superLocrian: [0, 1, 3, 4, 6, 8, 10],    // Mode 7 (Altered)

// Harmonic Minor Modes
harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
locrianNat6: [0, 1, 3, 5, 6, 9, 10],     // Mode 2
ionianAugmented: [0, 2, 4, 5, 8, 9, 11], // Mode 3
dorianSharp4: [0, 2, 3, 6, 7, 9, 10],    // Mode 4
phrygianDominant: [0, 1, 4, 5, 7, 8, 10], // Mode 5 (Spanish)
lydianSharp2: [0, 3, 4, 6, 7, 9, 11],    // Mode 6
ultraLocrian: [0, 1, 3, 4, 6, 8, 9],     // Mode 7

// Symmetric Scales
wholeTone: [0, 2, 4, 6, 8, 10],
diminishedHW: [0, 1, 3, 4, 6, 7, 9, 10], // Half-Whole
diminishedWH: [0, 2, 3, 5, 6, 8, 9, 11], // Whole-Half
augmented: [0, 3, 4, 7, 8, 11],

// Bebop Scales
bebopDominant: [0, 2, 4, 5, 7, 9, 10, 11],
bebopMajor: [0, 2, 4, 5, 7, 8, 9, 11],
bebopMinor: [0, 2, 3, 5, 7, 8, 9, 10],

// World Scales
hirajoshi: [0, 2, 3, 7, 8],              // Japanese
insen: [0, 1, 5, 7, 10],                 // Japanese
arabian: [0, 2, 4, 5, 6, 8, 10],
hungarian: [0, 2, 3, 6, 7, 8, 11],
```

---

### THEORY-004: Tritone Substitution

**Priority:** P3  
**Effort:** 30 minutes

**Solution:** Add to `src/harmony/progressions.ts`

```typescript
/**
 * Get the tritone substitution for a chord root.
 * Tritone sub replaces V7 with bII7 (6 semitones away).
 * 
 * @param root - Original root (e.g., 'G')
 * @returns Tritone substitute root (e.g., 'Db')
 */
export function tritoneSubstitute(root: string): string {
    const semitone = NOTE_TO_SEMITONE[root];
    if (semitone === undefined) {
        throw new Error(`Invalid root: ${root}`);
    }
    const subSemitone = (semitone + 6) % 12;
    return SEMITONE_TO_NOTE_FLAT[subSemitone];
}

/**
 * Apply tritone substitution to dominant chords in a progression.
 * 
 * @param chords - Chord symbols (e.g., ['Dm7', 'G7', 'Cmaj7'])
 * @returns Progression with tritone subs (e.g., ['Dm7', 'Db7', 'Cmaj7'])
 */
export function applyTritoneSubstitutions(chords: string[]): string[] {
    return chords.map(chord => {
        // Only substitute dominant 7th chords
        const match = chord.match(/^([A-G][#b]?)7$/);
        if (!match) return chord;
        
        const subRoot = tritoneSubstitute(match[1]);
        return `${subRoot}7`;
    });
}
```

---

## Summary Table

| ID | Fix | Phase | Effort | Status |
|----|-----|-------|--------|--------|
| BUILD-001 | Fix jest.config.cjs import | P0 | 5 min | PENDING |
| REWRITE-001 | Chord definitions (24-EDO native) | P1 | 2 hr | PENDING |
| REWRITE-002 | Scale definitions (24-EDO native) | P1 | 1.5 hr | PENDING |
| REWRITE-003 | Pitch utilities (24-EDO native) | P1 | 1 hr | PENDING |
| TEST-001 | Tests for new 24-EDO modules | P1 | 4-6 hr | PENDING |
| MIGRATE-001 | Delete legacy folder (cleanup) | P2 | 30 min | PENDING |
| ALLOC-001 | N/A (Main Thread acceptable) | - | - | WONTFIX |
| ALLOC-002 | N/A (Main Thread acceptable) | - | - | WONTFIX |
| THEORY-008 | MIDI constants | P3 | 1 hr | PENDING |
| THEORY-001 | Interval theory | P3 | 2 hr | PENDING |
| THEORY-003 | Advanced scales (already in P1) | P1 | - | MERGED |
| THEORY-004 | Tritone substitution | P3 | 30 min | PENDING |

---

## Recommended Implementation Order

1. **Session 1 (P0 + P1 Foundation):** ~5-6 hours
   - BUILD-001: Fix jest config (5 min)
   - Create folder structure: `src/chords/`, `src/scales/`, `src/pitch/`
   - REWRITE-001: Chord definitions (24-EDO native)
   - REWRITE-002: Scale definitions (24-EDO native)
   - REWRITE-003: Pitch utilities (24-EDO native)
   - Update `src/index.ts` exports
   - Verify build passes

2. **Session 2 (P1 Tests):** ~4-6 hours
   - TEST-001: Write tests for new 24-EDO modules
   - Test chord definitions and lookup
   - Test scale membership and quantization
   - Test pitch utilities
   - Run full test suite

3. **Session 3 (P2 Cleanup):** ~30 min
   - MIGRATE-001: Delete `src/legacy/` folder entirely
   - Legacy served its purpose as reference, no longer needed
   - NOTE: Legacy code is NOT migrated, it's REPLACED

4. **Session 4+ (P3 Enhancements):** ~4 hours
   - THEORY-008: MIDI constants (CC numbers, GM programs, drum map)
   - THEORY-001: Interval theory (quality, inversion)
   - THEORY-004: Tritone substitution
   - Add more advanced harmony features as needed

---

**End of Remediation Plan**
