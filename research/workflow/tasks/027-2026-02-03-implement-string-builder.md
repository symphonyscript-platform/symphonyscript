# Task 027: Implement StringBuilder

**Priority:** MEDIUM  
**Category:** Missing Feature  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit - Feature Gap

---

## Problem

No pitch bend or slide for string instruments.

## Current State

No `StringBuilder` class exists.

## Legacy Reference

```typescript
// packages/legacy/src/clip/StringBuilder.ts
class StringBuilder extends MelodyBuilder {
    bend(semitones: number): this {
        return this.play(Actions.bend(semitones))
    }
    
    slide(targetPitch: NoteName, duration: NoteDuration): this {
        return this.note(targetPitch, duration).legato().commit()
    }
    
    bendReset(): this {
        return this.play(Actions.bend(0))
    }
}
```

## Required Implementation

1. Create `StringBuilder` extending `SynapticMelody`
2. Add `bend(semitones)` method (pitch bend)
3. Add `slide(pitch, duration)` method
4. Add `bendReset()` method
5. Export from Clip factory

## Example

```typescript
Clip.string(bridge)
    .note('C4').commit()
    .bend(2)              // Bend up 2 semitones
    .slide('E4', '8n')    // Slide to E4
    .bendReset()
```

## Acceptance Criteria

- [ ] `StringBuilder` class exists
- [ ] `bend(2)` sends pitch bend
- [ ] `slide('E4', '8n')` plays legato note
- [ ] `bendReset()` resets pitch bend
- [ ] `Clip.string()` factory works
- [ ] Tests for string builder
