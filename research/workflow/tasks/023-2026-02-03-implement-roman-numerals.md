# Task 023: Implement Roman Numeral Chords

**Priority:** MEDIUM  
**Category:** Missing Feature  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit - Feature Gap

---

## Problem

No way to specify chords using Roman numeral notation.

## Current State

No `roman()` or `progression()` methods exist.

## Legacy Reference

```typescript
// packages/legacy/src/clip/MelodyBuilder.ts:438-539
roman(numeral: string, options?): MelodyChordCursor {
    const romanMap = {
        'I': [1, 3, 5], 'ii': [2, 4, 6], ...
    }
    // ...
}

progression(numerals: string[], options?): this {
    // Emit chord sequence
}

voiceLead(numerals: string[], options?): this {
    // Voice-led progression
}
```

## Required Implementation

1. Implement `roman(numeral, options)` method
2. Implement `progression(numerals, options)` method
3. Implement `voiceLead(numerals, options)` method
4. Add relay methods to cursor

## Example

```typescript
melody
    .key('C', 'major')
    .progression(['I', 'IV', 'V', 'I'])  // C, F, G, C
    
melody
    .key('G', 'major')
    .roman('ii').commit()   // Am
    .roman('V7').commit()   // D7
    .roman('I').commit()    // G
```

## Acceptance Criteria

- [ ] `roman('I')` returns chord cursor
- [ ] `roman('ii')` handles minor
- [ ] `roman('V7')` handles seventh chords
- [ ] `progression([...])` emits sequence
- [ ] Requires `key()` context
- [ ] Tests for roman numerals
