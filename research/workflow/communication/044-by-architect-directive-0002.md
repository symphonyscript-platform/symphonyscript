# Directive: Task 044 (Revised)

**Previous directive (0001) cancelled.** Legacy folder retained per human authority.

---

Implement interval theory functions in the theory package.

## Requirements

1. Create `packages/theory/src/pitch/intervals.ts`
2. Implement:
   - `getIntervalQuality(semitones, generic)` → `'P' | 'M' | 'm' | 'A' | 'd'`
   - `invertInterval(semitones)` → number (12 - semitones % 12)
   - `isEnharmonic(a, b)` → boolean (same pitch class mod 12)
3. Export from `packages/theory/src/pitch/index.ts`
4. All functions must be zero-allocation (pure arithmetic, no objects/arrays)

## Acceptance Criteria

- [ ] Three functions implemented
- [ ] Exported from pitch module
- [ ] Tests created (`packages/theory/src/__tests__/intervals.test.ts`)
- [ ] Build passes
- [ ] Tests pass
