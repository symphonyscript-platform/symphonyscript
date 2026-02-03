# Task 040: Implement Custom Drum Mapping

**Priority:** LOW  
**Category:** Missing Feature  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit - Feature Gap

---

## Problem

No way to customize drum sound mappings.

## Current State

Drum sounds hardcoded to GM standard.

## Legacy Reference

```typescript
// packages/legacy/src/clip/DrumBuilder.ts:62-64
withMapping<T extends { readonly [k: string]: NoteName }>(mapping: T): DrumBuilder {
    return this._withParams({ drumMap: { ...this._drumMap, ...mapping } })
}
```

## Required Implementation

1. Add `drumMap` to SynapticDrums state
2. Implement `withMapping(mapping)` method
3. Use map in `hit()` to resolve drum names

## Example

```typescript
const drums = Clip.drums(bridge).withMapping({
    'kick': 'C2',      // Custom kick pitch
    'snare': 'D2',     // Custom snare pitch
    'cowbell': 'G#2'   // Add new sound
})

drums.hit('cowbell').commit()  // Uses G#2
```

## Acceptance Criteria

- [ ] `withMapping({})` overrides default map
- [ ] Custom sounds can be added
- [ ] Existing sounds can be remapped
- [ ] `hit('custom')` uses custom pitch
- [ ] Tests for custom mapping
