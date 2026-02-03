# Task 036: Implement voice() for MPE

**Priority:** LOW  
**Category:** Missing Feature  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit - Feature Gap

---

## Problem

No way to create independent voice channels for MPE.

## Current State

No `voice()` method exists.

## Legacy Reference

```typescript
// packages/legacy/src/clip/MelodyBuilder.ts:777-794
voice(id: number, builderFn: (v: this) => this | MelodyNoteCursor): this {
    validate.inRange('voice', 'id', id, 1, 15)
    
    const voiceContext = this._createEmptyClone('VoiceContext')
        ._withParams({ expressionId: id })
    
    const result = builderFn(voiceContext)
    const voiceContent = (result instanceof MelodyNoteCursor) ? result.commit() : result
    
    // Append operations SEQUENTIALLY
    const operations = voiceContent._params.chain?.toArray() ?? []
    let current: this = this
    for (const op of operations) {
        current = current.addOp(op)
    }
    return current
}
```

## Required Implementation

1. Add `expressionId` to SynapticMelody state
2. Implement `voice(id, builderFn)` method
3. Tag all notes inside with expressionId
4. Support string voice names (hashed to ID)

## Example

```typescript
melody
    .voice(1, v => v.note('C4', '1n').tie('start').note('C4').tie('end'))
    .voice(2, v => v.note('E4', '4n').note('E4', '4n'))
```

## Acceptance Criteria

- [ ] `voice(1, fn)` tags notes with expressionId=1
- [ ] Voice IDs 1-15 supported (MPE range)
- [ ] Notes in different voices have independent ties
- [ ] Tests for voice scoping
