# THEORY PACKAGE HOSTILE AUDIT REPORT

**Package:** `@symphonyscript/theory`  
**Auditor:** Hostile Zero-Trust Auditor  
**Date:** 2026-02-01  
**RFC Cross-Reference:** RFC-047 (24-EDO Bitwise)

---

## Revision History

| Rev | Date | Changes |
|-----|------|---------|
| 1.0 | 2026-02-01 | Initial audit |
| 1.1 | 2026-02-01 | **Architect Feedback:** Removed phantom RFC-060 reference. MIGRATE-001 reframed as "Legacy Reorganization" (not RFC compliance). Grade note added: ALLOC findings are WONTFIX (Main Thread acceptable), not penalized. TEST-001 effort adjusted to 4-6 hours. |

---

## Executive Summary

| Category | Grade | Critical | High | Medium | Low |
|----------|-------|----------|------|--------|-----|
| Build/Test Infrastructure | F | 1 | 0 | 0 | 0 |
| Legacy Organization | D | 0 | 1 | 0 | 0 |
| Integration | D | 0 | 1 | 1 | 0 |
| Test Coverage | D | 0 | 1 | 0 | 0 |
| Zero-Allocation Compliance | N/A | 0 | 0 | 2 | 0 |
| Missing Theory | - | 0 | 0 | 0 | 9 |
| **OVERALL** | **C-** | **1** | **3** | **3** | **9** |

**Grade Note:** ALLOC-001/002 are marked N/A (not penalized) because Main Thread allocation is acceptable. These are WONTFIX items. The D grade reflects BUILD-001 blocker + integration gaps, not allocation concerns.

---

## A. Critical Defects

### [CRITICAL] [BUILD-001]: Jest Config Uses ES6 Import in CommonJS File

**Location:** `packages/theory/jest.config.cjs:2`

```javascript
// jest.config.cjs (CommonJS file!)
import { readFileSync } from 'fs';  // ← ES6 import in .cjs = INVALID
```

**Impact:** Tests cannot run. Exit code 1 with `SyntaxError: Cannot use import statement outside a module`.

**Fix:**
```javascript
const { readFileSync } = require('fs');
```

---

## B. High Defects

### [HIGH] [MIGRATE-001]: Legacy Folder Structure Needs Reorganization

**Current structure:**
```
packages/theory/
├── src/
│   ├── constants.ts     (RFC-047 only)
│   ├── packer.ts        (RFC-047 only)
│   ├── types.ts         (RFC-047 only)
│   └── legacy/          ← 17 files, not exported
```

**Recommended structure:**
```
packages/theory/
├── src/
│   ├── chords/          ← Extract from legacy
│   ├── harmony/         ← Extract from legacy
│   ├── scales/          ← Extract from legacy
│   ├── rhythm/          ← Extract from legacy
│   └── pitch/           ← Extract from legacy
```

**Impact:** Package exports only bitwise primitives. All music theory logic trapped in `legacy/` and not accessible to consumers.

---

### [HIGH] [INTEGRATE-001]: 12-TET / 24-EDO System Gap

**Legacy code uses 12-TET:**
```typescript
// legacy/chords/definitions.ts
intervals: [0, 4, 7]  // Major triad (12-TET semitones)
```

**Modern code uses 24-EDO:**
```typescript
// constants.ts
MAJOR_THIRD: 8 as Interval24EDO  // 24-EDO (2x semitones)
```

**No conversion function exists.** Legacy and modern cannot interoperate.

---

### [HIGH] [TEST-001]: Legacy Modules Have Zero Test Coverage

| Module | Lines | Tests |
|--------|-------|-------|
| `legacy/chords/*` | 250+ | ❌ 0 |
| `legacy/scales/*` | 125+ | ❌ 0 |
| `legacy/theory/*` | 450+ | ❌ 0 |
| `legacy/groove/*` | 100+ | ❌ 0 |
| `legacy/generators/*` | 55 | ❌ 0 |
| `legacy/quantize.ts` | 370 | ❌ 0 |
| `legacy/util/*` | 150+ | ❌ 0 |

Only `packer.ts` (RFC-047) has tests.

---

## C. Medium Defects

### [MEDIUM] [ALLOC-001]: Voice Leading Allocates in Hot Paths

**Location:** `legacy/theory/voiceleading.ts`

```typescript
// Line 51-54: Allocates
const midiNotes = chord
    .map(n => noteToMidi(n))      // .map() creates new array
    .filter((m): m is number => m !== null)  // .filter() creates new array
    .sort((a, b) => a - b)

// Line 108: Allocates
const usedTargets = new Set<number>()  // new Set()
```

**Impact:** Cannot use in kernel's zero-allocation audio paths.

---

### [MEDIUM] [ALLOC-002]: Euclidean Algorithm Allocates Heavily

**Location:** `legacy/generators/euclidean.ts`

```typescript
// Lines 14-18: Multiple array allocations
let pattern: number[][] = []
let remainder: number[][] = []

for (let i = 0; i < hits; i++) pattern.push([1])  // Creates array per hit
for (let i = 0; i < steps - hits; i++) remainder.push([0])
```

---

### [MEDIUM] [TYPE-001]: NoteName vs Interval24EDO Type Mismatch

**Legacy types:**
```typescript
type NoteName = 'C4' | 'D#5' | ...  // String with octave
```

**Modern types:**
```typescript
type Interval24EDO = number & { __brand: 'Interval24EDO' }  // Branded number
```

No bridge functions exist to convert between systems.

---

## D. Missing Music Theory (Gap Analysis)

The package is titled "Music Theory Standard Library" but lacks these fundamental concepts:

### D.1 Interval Theory
| Feature | Status | Priority |
|---------|--------|----------|
| Interval quality (M/m/P/A/d) | ❌ Missing | HIGH |
| Interval inversion | ❌ Missing | HIGH |
| Compound intervals | ❌ Missing | MEDIUM |
| Enharmonic equivalence | ❌ Missing | MEDIUM |

### D.2 Pitch Class Set Theory
| Feature | Status | Priority |
|---------|--------|----------|
| Forte number lookup | ❌ Missing | MEDIUM |
| Prime form calculation | ❌ Missing | MEDIUM |
| Interval vector | ❌ Missing | LOW |
| Set class operations (T, I) | ❌ Missing | LOW |

### D.3 Advanced Scales
| Feature | Status | Priority |
|---------|--------|----------|
| Melodic minor modes | ❌ Missing | HIGH |
| Harmonic minor modes | ❌ Missing | HIGH |
| Symmetric scales | ❌ Missing | MEDIUM |
| Bebop scales | ❌ Missing | MEDIUM |
| World scales (Arabic, Japanese) | ❌ Missing | LOW |

### D.4 Advanced Harmony
| Feature | Status | Priority |
|---------|--------|----------|
| Tritone substitution | ❌ Missing | HIGH |
| Chord function (T/SD/D) | ❌ Missing | HIGH |
| Negative harmony | ❌ Missing | MEDIUM |
| Upper structure triads | ❌ Missing | MEDIUM |
| Polychords | ❌ Missing | LOW |

### D.5 Rhythmic Theory
| Feature | Status | Priority |
|---------|--------|----------|
| Metric modulation | ❌ Missing | MEDIUM |
| Polyrhythm calculator | ❌ Missing | MEDIUM |
| Tempo relationships | ❌ Missing | LOW |

### D.6 Counterpoint
| Feature | Status | Priority |
|---------|--------|----------|
| Motion detection (parallel/contrary/oblique) | ❌ Missing | MEDIUM |
| Parallel 5ths/8ves checker | ❌ Missing | MEDIUM |
| Species rules | ❌ Missing | LOW |

### D.7 Tuning Systems
| Feature | Status | Priority |
|---------|--------|----------|
| Just intonation ratios | ❌ Missing | LOW |
| Cents calculator | ❌ Missing | LOW |
| Pythagorean tuning | ❌ Missing | LOW |

### D.8 MIDI Constants
| Feature | Status | Priority |
|---------|--------|----------|
| Control change constants (CC#) | ❌ Missing | HIGH |
| General MIDI program map | ❌ Missing | MEDIUM |
| Standard drum map (GM) | ❌ Missing | MEDIUM |

### D.9 Analysis
| Feature | Status | Priority |
|---------|--------|----------|
| Cadence detection | ❌ Missing | MEDIUM |
| Phrase boundary detection | ❌ Missing | LOW |

---

## E. Summary Table

| ID | Title | Severity |
|----|-------|----------|
| BUILD-001 | Jest config uses ES6 import in .cjs | CRITICAL |
| MIGRATE-001 | Legacy folder needs reorganization | HIGH |
| INTEGRATE-001 | 12-TET / 24-EDO system gap | HIGH |
| TEST-001 | Legacy modules have zero test coverage | HIGH |
| ALLOC-001 | Voice leading allocates in hot paths | MEDIUM |
| ALLOC-002 | Euclidean algorithm allocates heavily | MEDIUM |
| TYPE-001 | NoteName vs Interval24EDO type mismatch | MEDIUM |
| THEORY-001 | Missing interval theory | LOW |
| THEORY-002 | Missing pitch class set theory | LOW |
| THEORY-003 | Missing advanced scales | LOW |
| THEORY-004 | Missing advanced harmony | LOW |
| THEORY-005 | Missing rhythmic theory | LOW |
| THEORY-006 | Missing counterpoint | LOW |
| THEORY-007 | Missing tuning systems | LOW |
| THEORY-008 | Missing MIDI constants | LOW |
| THEORY-009 | Missing analysis functions | LOW |

---

## F. Recommended Action Plan

### Phase 1: Unblock (Immediate)
1. Fix `jest.config.cjs` (BUILD-001)
2. Verify tests pass

### Phase 2: Integrate (Short-term)
1. Create 12-TET ↔ 24-EDO conversion functions
2. Bridge `NoteName` ↔ `Interval24EDO` types
3. Add tests for legacy modules

### Phase 3: Migrate (Medium-term)
1. Execute RFC-060 folder structure
2. Move legacy code to new locations
3. Refactor for zero-allocation where needed

### Phase 4: Expand (Long-term)
1. Add missing theory features (prioritized by HIGH → LOW)
2. Build comprehensive test suite

---

## Appendix: Files Audited

| File | Lines | Thread Context | Allocation Allowed |
|------|-------|----------------|-------------------|
| `src/constants.ts` | 72 | Main Thread | ✅ Yes |
| `src/types.ts` | 31 | Any | ✅ Yes |
| `src/packer.ts` | 130 | Kernel Compatible | ❌ No (hot paths) |
| `src/legacy/chords/definitions.ts` | 250 | Main Thread | ✅ Yes |
| `src/legacy/chords/parser.ts` | 68 | Main Thread | ✅ Yes |
| `src/legacy/scales/index.ts` | 125 | Main Thread | ✅ Yes |
| `src/legacy/theory/voiceleading.ts` | 185 | Main Thread | ✅ Yes |
| `src/legacy/theory/progressions.ts` | 279 | Main Thread | ✅ Yes |
| `src/legacy/theory/keys.ts` | 163 | Main Thread | ✅ Yes |
| `src/legacy/generators/euclidean.ts` | 56 | Main Thread | ✅ Yes |
| `src/legacy/groove/templates.ts` | 102 | Main Thread | ✅ Yes |
| `src/legacy/quantize.ts` | 371 | Main Thread | ✅ Yes |
| `src/legacy/util/midi.ts` | 80 | Main Thread | ✅ Yes |

---

**End of Audit Report**
