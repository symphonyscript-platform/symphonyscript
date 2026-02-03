# Task 025: Implement KeyboardBuilder

**Priority:** MEDIUM  
**Category:** Missing Feature  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit - Feature Gap

---

## Problem

No sustain pedal support for piano/keyboard instruments.

## Current State

No `KeyboardBuilder` class exists.

## Legacy Reference

```typescript
// packages/legacy/src/clip/KeyboardBuilder.ts
class KeyboardBuilder extends MelodyBuilder {
    sustain(): this {
        return this.play(Actions.sustain())  // CC64 = 127
    }
    
    release(): this {
        return this.play(Actions.release())  // CC64 = 0
    }
}
```

## Required Implementation

1. Create `KeyboardBuilder` extending `SynapticMelody`
2. Add `sustain()` method (CC64 on)
3. Add `release()` method (CC64 off)
4. Export from Clip factory

## Example

```typescript
Clip.keyboard(bridge)
    .sustain()
    .note('C4').commit()
    .note('E4').commit()
    .note('G4').commit()
    .release()
```

## Acceptance Criteria

- [ ] `KeyboardBuilder` class exists
- [ ] `sustain()` sends CC64 = 127
- [ ] `release()` sends CC64 = 0
- [ ] `Clip.keyboard()` factory works
- [ ] Tests for keyboard builder
