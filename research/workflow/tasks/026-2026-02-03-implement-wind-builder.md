# Task 026: Implement WindBuilder

**Priority:** MEDIUM  
**Category:** Missing Feature  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit - Feature Gap

---

## Problem

No breath control for wind instruments.

## Current State

No `WindBuilder` class exists.

## Legacy Reference

```typescript
// packages/legacy/src/clip/WindBuilder.ts
class WindBuilder extends MelodyBuilder {
    breath(amount: number): this {
        return this.play(Actions.breath(amount))  // CC2
    }
    
    expressionCC(amount: number): this {
        return this.play(Actions.expression(amount))  // CC11
    }
}
```

## Required Implementation

1. Create `WindBuilder` extending `SynapticMelody`
2. Add `breath(amount)` method (CC2)
3. Add `expressionCC(amount)` method (CC11)
4. Export from Clip factory

## Example

```typescript
Clip.wind(bridge)
    .breath(0.8)
    .note('C4').commit()
    .expressionCC(0.5)
    .note('D4').commit()
```

## Acceptance Criteria

- [ ] `WindBuilder` class exists
- [ ] `breath(0.8)` sends CC2 = 102 (0.8 * 127)
- [ ] `expressionCC(0.5)` sends CC11 = 64
- [ ] `Clip.wind()` factory works
- [ ] Tests for wind builder
