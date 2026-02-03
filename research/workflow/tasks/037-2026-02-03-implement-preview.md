# Task 037: Implement preview() ASCII Visualization

**Priority:** LOW  
**Category:** Missing Feature  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit - Feature Gap

---

## Problem

No way to visualize clip content in console.

## Current State

No `preview()` method exists.

## Legacy Reference

```typescript
// packages/legacy/src/clip/ClipBuilder.ts:85-91
preview(bpm: number = 120): this {
    const clip = this.build()
    const compiled = compileClip(clip, { bpm })
    compiled.print?.()
    return this
}
```

## Required Implementation

1. Implement `preview(bpm)` on SynapticClip
2. Create ASCII representation of notes
3. Show pitch, timing, velocity

## Example Output

```
Clip: Melody (120 BPM)
Beat: |1---2---3---4---|1---2---3---4---|
C4:   |X...X...........|................|
E4:   |....X...........|................|
G4:   |........X.......|................|
```

## Acceptance Criteria

- [ ] `preview()` prints ASCII grid
- [ ] Shows note positions
- [ ] Supports different BPMs
- [ ] Returns `this` for chaining
- [ ] Tests (snapshot tests)
