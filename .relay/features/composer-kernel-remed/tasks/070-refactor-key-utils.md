# Task 070: Refactor key.ts Utility Allocations

**Priority:** HIGH  
**Category:** Zero-Allocation Remediation  
**Status:** Open  
**Created:** 2026-02-08  
**Source:** Composer & Kernel Remediation Plan - Gap Analysis

---

## Problem

`key.ts` utilities allocate objects and strings:
- `parseNoteName()` returns `{ letter, accidental, octave }` object
- `applyKeySignature()` calls `parseNoteName()` per note
- Template string interpolation `${...}` allocates strings

## Current State

```typescript
// key.ts
function parseNoteName(note: string): { letter: NoteLetter; accidental: string; octave: string } | null {
    const match = note.match(/^([A-Ga-g])([#b]?)(\d+)$/);
    if (!match) return null;
    return {
        letter: match[1].toUpperCase() as NoteLetter,  // ❌ Object allocation
        accidental: match[2],
        octave: match[3]
    };
}

export function applyKeySignature(noteName: string, ...): string {
    const parsed = parseNoteName(noteName);  // ❌ Called per note
    // ...
    return `${parsed.letter}${accidentalSymbol}${parsed.octave}`;  // ❌ String allocation
}
```

## Required Implementation

Use out-parameter pattern like `chord.ts`:

```typescript
// Module-level reusable result object
interface ParsedNote {
    letter: number;      // 0-6 for A-G
    accidental: number;  // -1, 0, 1 for flat, natural, sharp
    octave: number;
}

const PARSED_NOTE: ParsedNote = { letter: 0, accidental: 0, octave: 4 };

function parseNoteName(note: string, out: ParsedNote = PARSED_NOTE): ParsedNote | null {
    // Parse into out parameter
    out.letter = ...;
    out.accidental = ...;
    out.octave = ...;
    return out;
}

// For applyKeySignature, consider returning MIDI pitch number instead of string
// Or use pre-allocated char buffers if string output is required
```

## Files to Modify

- `[MODIFY] packages/composer/src/utils/key.ts`

## Dependencies

- None

## Acceptance Criteria

- [ ] `parseNoteName()` uses out-parameter pattern
- [ ] Module-level reusable result object exists
- [ ] `applyKeySignature()` minimizes string allocations
- [ ] Consider returning numeric pitch class instead of formatted string
- [ ] `pnpm build && pnpm test` passes
