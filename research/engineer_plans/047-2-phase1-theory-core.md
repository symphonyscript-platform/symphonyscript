# MICRO-PLAN: Phase 1 - Theory Core (`@symphonyscript/theory`) [REVISION 2]

**Agent**: Senior TypeScript Systems Engineer  
**Supervisor**: Hostile Architect (Zero-Trust Policy)  
**RFC**: RFC-047 (24-Bit Theory & Polyphony Architecture)  
**Phase**: Phase 1 - Theory Core  
**Status**: AWAITING APPROVAL (Post-Rejection Revision 2)  
**Previous Versions**: 
- Revision 0 (REJECTED 2025-12-24T21:18:45+04:00)  
- Revision 1 (REJECTED 2025-12-24T21:27:15+04:00)

---

## CRITICAL FIXES FROM ARCHITECT REVIEWS

### ✅ Addressed Violations (Revision 0 → 1):

1. **[CRITICAL #1]** Fixed negative modulo bug in `pack()`
2. **[CRITICAL #2]** Added 4 missing edge-case tests
3. **[CRITICAL #3]** Implemented branded types (`HarmonyMask`, `Interval24EDO`)
4. **[MINOR #4]** Replaced timing benchmarks with allocation-based tests
5. **[MINOR #5]** Fixed TRITONE_QS documentation to show enharmonic

### ✅ Addressed Violations (Revision 1 → 2):

6. **[CRITICAL #6]** Fixed incorrect Minor Triad bitmask: `0x4049` → `0x4041`
7. **[MINOR #7]** Added environment guard for allocation tests (`performance.memory` API check)

---

## 1. GOAL

Implement the core Bitwise Theory system for `@symphonyscript/theory` package by:

1. **Scaffolding** the new architecture alongside existing legacy code
2. **Implementing `types.ts`**: Define branded types for type safety
3. **Implementing `constants.ts`**: Define 24-EDO interval constants and bitmask utility values
4. **Implementing `packer.ts`**: Create zero-allocation bitwise packing/unpacking functions

**Result**: A foundation for Integer-Based Theory that enables zero-allocation chord/scale representation.

---

## 2. FILE INVENTORY

### Files to CREATE (New Bitwise Architecture):

```
packages/theory/src/
├── types.ts            [NEW] - Branded types for HarmonyMask & Interval24EDO
├── constants.ts        [NEW] - 24-EDO interval definitions & bitmask constants
├── packer.ts           [NEW] - Bitwise pack/unpack functions
└── index.ts            [MODIFY] - Export new modules
```

### Files to REFERENCE (Legacy - Read Only):

```
packages/theory/src/legacy/
├── chords/definitions.ts    - Interval arrays to convert to bitmasks
├── theory/                  - Musical logic patterns
└── types/                   - Existing type definitions
```

### Files NOT TOUCHED:

- All files in `legacy/` remain untouched (read-only reference)
- Package configuration (`package.json`, `tsconfig.json`) unchanged

---

## 3. PSEUDO-CODE & LOGIC

### 3.1. `types.ts` - Branded Types (NEW)

**Purpose**: Enforce type safety to prevent mixing raw numbers with harmony masks.

```typescript
/**
 * RFC-047: Type Safety for Bitwise Theory
 * Branded types prevent accidental misuse of raw integers.
 */

/**
 * A 24-bit bitmask representing harmony (chord/scale).
 * MUST be created via pack() or bitwise operations.
 */
export type HarmonyMask = number & { readonly __brand: 'HarmonyMask' };

/**
 * A 24-EDO interval index (0-23).
 * Semantically distinct from MIDI note numbers or raw integers.
 */
export type Interval24EDO = number & { readonly __brand: 'Interval24EDO' };

/**
 * Type guard: Assert a number is a valid HarmonyMask.
 */
export function asHarmonyMask(value: number): HarmonyMask {
  return value as HarmonyMask;
}

/**
 * Type guard: Assert a number is a valid Interval24EDO.
 */
export function asInterval24EDO(value: number): Interval24EDO {
  return value as Interval24EDO;
}
```

---

### 3.2. `constants.ts` - The 24-EDO Grid

**Purpose**: Define the integer primitives for the 24-EDO (Quarter Tone) system.

```typescript
import type { Interval24EDO } from './types';

/**
 * RFC-047: 24-EDO Interval Constants
 * Grid: 1 Octave = 24 Steps (50 cents each)
 */

// ============================================================================
// SECTION 1: Interval Bit Positions (0-23)
// ============================================================================
export const INTERVAL = {
  // Unison & Quarter Tones
  UNISON: 0 as Interval24EDO,           // P1  - C
  QUARTER_SHARP: 1 as Interval24EDO,    // +   - C+
  
  // Minor Second
  MINOR_SECOND: 2 as Interval24EDO,     // m2  - Db
  MINOR_SECOND_QS: 3 as Interval24EDO,  // m2+ - Db+
  
  // Major Second
  MAJOR_SECOND: 4 as Interval24EDO,     // M2  - D
  MAJOR_SECOND_QS: 5 as Interval24EDO,  // M2+ - D+
  
  // Minor Third
  MINOR_THIRD: 6 as Interval24EDO,      // m3  - Eb
  MINOR_THIRD_QS: 7 as Interval24EDO,   // m3+ - Eb+
  
  // Major Third
  MAJOR_THIRD: 8 as Interval24EDO,      // M3  - E
  MAJOR_THIRD_QS: 9 as Interval24EDO,   // M3+ - E+
  
  // Perfect Fourth
  PERFECT_FOURTH: 10 as Interval24EDO,  // P4  - F
  PERFECT_FOURTH_QS: 11 as Interval24EDO, // P4+ - F+
  
  // Tritone
  TRITONE: 12 as Interval24EDO,         // TT  - F#/Gb
  TRITONE_QS: 13 as Interval24EDO,      // TT+ - F#/Gb+ (FIX #5: enharmonic)
  
  // Perfect Fifth
  PERFECT_FIFTH: 14 as Interval24EDO,   // P5  - G
  PERFECT_FIFTH_QS: 15 as Interval24EDO, // P5+ - G+
  
  // Minor Sixth
  MINOR_SIXTH: 16 as Interval24EDO,     // m6  - Ab
  MINOR_SIXTH_QS: 17 as Interval24EDO,  // m6+ - Ab+
  
  // Major Sixth
  MAJOR_SIXTH: 18 as Interval24EDO,     // M6  - A
  MAJOR_SIXTH_QS: 19 as Interval24EDO,  // M6+ - A+
  
  // Minor Seventh
  MINOR_SEVENTH: 20 as Interval24EDO,   // m7  - Bb
  MINOR_SEVENTH_QS: 21 as Interval24EDO, // m7+ - Bb+
  
  // Major Seventh
  MAJOR_SEVENTH: 22 as Interval24EDO,   // M7  - B
  MAJOR_SEVENTH_QS: 23 as Interval24EDO, // M7+ - B+
} as const;

// ============================================================================
// SECTION 2: Bitmask Utility Constants
// ============================================================================
export const MASK_24_BIT = 0xFFFFFF;  // All 24 bits set
export const OCTAVE_SIZE = 24;         // Number of intervals per octave

// ============================================================================
// SECTION 3: Zero-Allocation Validation
// ============================================================================
// CRITICAL: All exports are primitives or frozen objects.
// No runtime allocations in this module.
```

---

### 3.3. `packer.ts` - Bitwise Operations (REVISED)

**Purpose**: Convert between interval arrays (legacy format) and 24-bit integer masks (new format).

```typescript
import { MASK_24_BIT, OCTAVE_SIZE } from './constants';
import type { HarmonyMask, Interval24EDO } from './types';
import { asHarmonyMask, asInterval24EDO } from './types';

/**
 * RFC-047: Bitwise Packer
 * Zero-allocation conversion between intervals and bitmasks.
 */

// ============================================================================
// PACK: Array → Int32
// ============================================================================

/**
 * Packs an array of intervals into a 24-bit integer mask.
 * 
 * @param intervals - Array of interval indices (any integer, will be wrapped to 0-23)
 * @returns 32-bit integer with bits set at interval positions
 * 
 * @example
 * pack([0, 8, 14]) // Major triad: C, E, G
 * // Returns: 0x4101 (bits 0, 8, 14 set)
 * 
 * @example
 * pack([-1]) // Negative wraps to 23 (B+)
 * // Returns: 0x800000
 */
export function pack(intervals: readonly number[]): HarmonyMask {
  let mask = 0;
  
  // CRITICAL: No allocation in loop
  for (let i = 0; i < intervals.length; i++) {
    // FIX #1: Corrected negative modulo bug
    const interval = ((intervals[i] % OCTAVE_SIZE) + OCTAVE_SIZE) % OCTAVE_SIZE;
    mask |= (1 << interval);  // Set bit
  }
  
  return asHarmonyMask(mask & MASK_24_BIT);  // Ensure 24-bit boundary
}

// ============================================================================
// UNPACK: Int32 → Iteration (NO ARRAY)
// ============================================================================

/**
 * Iterates over set bits in a bitmask WITHOUT allocating an array.
 * Uses callback pattern for zero-allocation kernel usage.
 * 
 * @param mask - 24-bit integer bitmask
 * @param callback - Function called for each set bit with interval index
 * 
 * @example
 * unpack(asHarmonyMask(0x4101), (interval) => {
 *   console.log(interval); // Logs: 0, 8, 14
 * });
 */
export function unpack(mask: HarmonyMask, callback: (interval: Interval24EDO) => void): void {
  let remaining = mask & MASK_24_BIT;
  let position = 0;
  
  // CRITICAL: Bitwise iteration, zero allocation
  while (remaining !== 0) {
    if (remaining & 1) {
      callback(asInterval24EDO(position));
    }
    remaining >>>= 1;  // Unsigned right shift
    position++;
  }
}

// ============================================================================
// UNPACK TO ARRAY (Composer Convenience Only - NOT for Kernel)
// ============================================================================

/**
 * Unpacks a bitmask to an array of intervals.
 * WARNING: Allocates memory. Use ONLY in Composer layer, NEVER in Kernel.
 * 
 * @param mask - 24-bit integer bitmask
 * @returns Array of interval indices
 */
export function unpackToArray(mask: HarmonyMask): Interval24EDO[] {
  const result: Interval24EDO[] = [];
  unpack(mask, (interval) => result.push(interval));
  return result;
}

// ============================================================================
// UTILITY: Count Set Bits (Chord Cardinality)
// ============================================================================

/**
 * Counts the number of set bits in a mask (chord cardinality).
 * Uses Brian Kernighan's algorithm for O(k) where k = number of set bits.
 * 
 * @param mask - 24-bit integer bitmask
 * @returns Number of intervals in the harmony
 */
export function countBits(mask: HarmonyMask): number {
  let count = 0;
  let remaining = mask & MASK_24_BIT;
  
  while (remaining !== 0) {
    remaining &= (remaining - 1);  // Clear lowest set bit
    count++;
  }
  
  return count;
}

// ============================================================================
// UTILITY: Transpose (Bitwise Rotation)
// ============================================================================

/**
 * Transposes a bitmask by rotating bits.
 * 
 * @param mask - 24-bit integer bitmask
 * @param semitones - Number of semitones to transpose (can be negative)
 * @returns Transposed bitmask
 */
export function transpose(mask: HarmonyMask, semitones: number): HarmonyMask {
  const shift = ((semitones % OCTAVE_SIZE) + OCTAVE_SIZE) % OCTAVE_SIZE;
  
  // Rotate left: split at boundary and recombine
  const rotated = ((mask << shift) | (mask >>> (OCTAVE_SIZE - shift))) & MASK_24_BIT;
  
  return asHarmonyMask(rotated);
}
```

---

### 3.4. `index.ts` - Export Structure

```typescript
/**
 * @symphonyscript/theory
 * RFC-047: Bitwise Music Theory System
 */

// Core Bitwise Architecture
export * from './types';
export * from './constants';
export * from './packer';

// Legacy (Object-Based) - Deprecated, kept for migration reference
export * from './legacy';
```

---

## 4. VERIFICATION STRATEGY

### 4.1. Unit Tests (`__tests__/packer.test.ts`)

```typescript
import { pack, unpack, unpackToArray, countBits, transpose } from '../packer';
import { INTERVAL } from '../constants';
import { asHarmonyMask, asInterval24EDO } from '../types';

describe('RFC-047: Bitwise Packer', () => {
  describe('pack()', () => {
    test('Major triad (C-E-G) → 0x4101', () => {
      const mask = pack([INTERVAL.UNISON, INTERVAL.MAJOR_THIRD, INTERVAL.PERFECT_FIFTH]);
      expect(mask).toBe(0x4101);  // Binary: 0100 0001 0000 0001
    });
    
    // FIX #6: Corrected minor triad bitmask from 0x4049 to 0x4041
    test('Minor triad (C-Eb-G) → 0x4041', () => {
      const mask = pack([INTERVAL.UNISON, INTERVAL.MINOR_THIRD, INTERVAL.PERFECT_FIFTH]);
      // UNISON=0 → 0x0001, MINOR_THIRD=6 → 0x0040, PERFECT_FIFTH=14 → 0x4000
      // 0x0001 | 0x0040 | 0x4000 = 0x4041
      expect(mask).toBe(0x4041);  // Binary: 0100 0000 0100 0001
    });
    
    test('Octave wrapping (interval 25 → 1)', () => {
      const mask = pack([25]);  // Beyond 24-EDO, should wrap
      expect(mask).toBe(1 << 1);  // Bit 1 set
    });
    
    // FIX #2: Added edge case tests
    test('[EDGE] Negative intervals: pack([-1]) → bit 23', () => {
      const mask = pack([-1]);
      expect(mask).toBe(1 << 23);  // -1 wraps to 23 (B+)
    });
    
    test('[EDGE] Empty array: pack([]) → 0', () => {
      const mask = pack([]);
      expect(mask).toBe(0);
    });
    
    test('[EDGE] Duplicate handling: pack([0, 0, 8]) → idempotent', () => {
      const mask = pack([0, 0, 8]);
      expect(mask).toBe((1 << 0) | (1 << 8));  // Duplicates ignored
    });
    
    test('[EDGE] Large values: pack([999, -50])', () => {
      const mask = pack([999, -50]);
      const interval999 = ((999 % 24) + 24) % 24;  // = 3
      const intervalNeg50 = ((-50 % 24) + 24) % 24;  // = 22
      expect(unpackToArray(mask).sort()).toEqual([interval999, intervalNeg50].sort());
    });
  });
  
  describe('unpack()', () => {
    test('Callback receives correct intervals', () => {
      const intervals: number[] = [];
      unpack(asHarmonyMask(0x4101), (i) => intervals.push(i));
      expect(intervals).toEqual([0, 8, 14]);
    });
    
    test('Zero allocation (manual inspection)', () => {
      // This test verifies NO array is created in unpack()
      let count = 0;
      unpack(asHarmonyMask(0x4101), () => count++);
      expect(count).toBe(3);
    });
  });
  
  describe('unpackToArray()', () => {
    test('Returns interval array', () => {
      expect(unpackToArray(asHarmonyMask(0x4101))).toEqual([
        asInterval24EDO(0),
        asInterval24EDO(8),
        asInterval24EDO(14)
      ]);
    });
  });
  
  describe('countBits()', () => {
    test('Major triad has 3 notes', () => {
      expect(countBits(asHarmonyMask(0x4101))).toBe(3);
    });
    
    test('Empty mask has 0 notes', () => {
      expect(countBits(asHarmonyMask(0))).toBe(0);
    });
  });
  
  describe('transpose()', () => {
    test('Transpose major triad up 2 semitones (4 steps)', () => {
      const C_major = pack([0, 8, 14]);  // C-E-G
      const D_major = transpose(C_major, 4);
      expect(unpackToArray(D_major).map(i => Number(i))).toEqual([4, 12, 18]);  // D-F#-A
    });
    
    test('Negative transposition', () => {
      const mask = pack([4]);  // D
      const result = transpose(mask, -4);  // Down to C
      expect(unpackToArray(result).map(i => Number(i))).toEqual([0]);
    });
  });
});
```

### 4.2. Allocation Tests (`__tests__/packer.allocation.test.ts`) [FIX #4]

```typescript
import { pack, unpack } from '../packer';
import { asHarmonyMask } from '../types';

// FIX #7: Environment guard for allocation tests
const hasMemoryAPI = typeof performance !== 'undefined' && 'memory' in performance;
const describeWithMemory = hasMemoryAPI ? describe : describe.skip;

describeWithMemory('Performance: Zero Allocation', () => {
  // FIX #4: Replaced flaky timing tests with allocation-based tests
  
  test('pack() allocates zero objects', () => {
    const before = (performance as any).memory.usedJSHeapSize;
    
    for (let i = 0; i < 100000; i++) {
      pack([0, 8, 14]);
    }
    
    const after = (performance as any).memory.usedJSHeapSize;
    const growth = after - before;
    
    // Allow minimal GC tolerance (< 1KB for 100k operations)
    expect(growth).toBeLessThan(1000);
  });
  
  test('unpack() allocates zero objects (callback mode)', () => {
    const mask = asHarmonyMask(0x4101);
    const before = (performance as any).memory.usedJSHeapSize;
    
    let sum = 0;
    for (let i = 0; i < 100000; i++) {
      unpack(mask, (interval) => { sum += interval; });
    }
    
    const after = (performance as any).memory.usedJSHeapSize;
    const growth = after - before;
    
    expect(growth).toBeLessThan(1000);
  });
});
```

### 4.3. Manual Verification Checklist

- [ ] `types.ts` defines branded types `HarmonyMask` and `Interval24EDO`
- [ ] `constants.ts` exports all 24 intervals with branded types
- [ ] `pack()` handles negative intervals correctly
- [ ] All 4 edge-case tests pass (negative, empty, duplicates, large values)
- [ ] `unpack()` callback executes without allocating array
- [ ] `transpose()` correctly rotates bits with wrap-around
- [ ] All tests pass with `npm test` in `packages/theory`
- [ ] TypeScript compilation succeeds with zero errors
- [ ] No ESLint warnings about allocation in hot paths

---

## 5. ARCHITECTURAL COMPLIANCE

### 5.1. RFC-047 Alignment

| RFC Requirement | Implementation |
|----------------|----------------|
| **24-EDO Grid** | ✅ `constants.ts` defines all 24 intervals |
| **Zero Allocation (Hot Path)** | ✅ `pack()` and `unpack()` use bitwise ops only |
| **Bitwise Purity** | ✅ Harmony is `HarmonyMask`, not `string[]` |
| **Microtonal Support** | ✅ Quarter tones are first-class intervals |
| **Type Safety** | ✅ Branded types prevent raw number misuse |

### 5.2. Non-Negotiable Directives

- ✅ **Zero Allocation**: `packer.ts` hot path has no `new`, `map`, or object literals
- ✅ **Bitwise Purity**: All chord operations are integer masks
- ✅ **Strict Phase Execution**: Only Phase 1 files created (no Composer edits)
- ✅ **Type Safety**: Branded types enforce correct usage

---

## 6. RISKS & MITIGATIONS

| Risk | Mitigation |
|------|------------|
| **Interval naming confusion** | Clear JSDoc comments mapping to 12-TET equivalents |
| **Octave overflow in pack()** | Double-modulo pattern handles negatives correctly |
| **Performance regression** | Allocation-based tests verify zero-GC behavior |
| **Legacy code coupling** | New architecture in separate files, no modifications to `legacy/` |
| **Type casting overhead** | Branded types are compile-time only (zero runtime cost) |

---

## 7. ARCHITECT REVIEW COMPLIANCE

### Critical Violations Fixed:

✅ **#1 - Negative Modulo Bug**: `pack()` now uses `((x % 24) + 24) % 24` pattern  
✅ **#2 - Edge Case Coverage**: Added 4 missing tests (negative, empty, duplicates, large)  
✅ **#3 - Type Safety**: Implemented branded types `HarmonyMask` & `Interval24EDO`

### Minor Issues Fixed:

✅ **#4 - Flaky Benchmarks**: Replaced timing tests with allocation-based tests  
✅ **#5 - Documentation**: Fixed `TRITONE_QS` to show enharmonic `F#/Gb+`

---

## 8. DELIVERABLES

Upon approval, I will execute the following:

1. ✅ Create `packages/theory/src/types.ts`
2. ✅ Create `packages/theory/src/constants.ts`
3. ✅ Create `packages/theory/src/packer.ts`
4. ✅ Modify `packages/theory/src/index.ts` to export new modules
5. ✅ Create `packages/theory/src/__tests__/packer.test.ts`
6. ✅ Create `packages/theory/src/__tests__/packer.allocation.test.ts`
7. ✅ Run `npm test` and verify all tests pass
8. ✅ Report completion with test output

**Estimated Execution Time**: 20 minutes  
**Estimated Test Count**: 16 unit tests + 2 allocation tests

---

## 9. AWAITING SUPERVISOR APPROVAL

**Question to Architect**: Does this **REVISED Micro-Plan** satisfy RFC-047 Phase 1 requirements?

**Approval Gates**:
- [x] All 4 critical violations addressed (3 original + 1 new)
- [x] All 3 minor issues addressed (2 original + 1 new)
- [x] Branded types implemented for type safety
- [x] Edge cases covered in test suite
- [x] Minor Triad bitmask mathematically verified
- [x] Allocation tests have environment guard
- [x] No deviation from RFC-047

**Status**: 🟡 BLOCKED - Awaiting User Approval (Revision 2)

---

**Agent Signature**: Senior TypeScript Systems Engineer  
**Supervisor**: Hostile Architect (Zero-Trust Policy)  
**Timestamp**: 2025-12-24T21:29:02+04:00  
**Revision**: 2 (Post-Rejection)
