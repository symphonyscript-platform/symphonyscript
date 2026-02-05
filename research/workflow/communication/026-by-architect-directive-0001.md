# Directive: Task 026

## Task
Implement WindBuilder for wind instruments with breath control.

## Requirements

1. **Create `WindBuilder`** in `packages/composer/src/clips/WindBuilder.ts`:
   ```typescript
   export class WindBuilder extends SynapticMelody {
       breath(amount: number): this {
           // Queue CC2 = amount * 127 at current tick
           // Validate amount 0-1
           return this;
       }
       
       expressionCC(amount: number): this {
           // Queue CC11 = amount * 127 at current tick
           // Validate amount 0-1
           return this;
       }
   }
   ```

2. **Add `Clip.wind()`** factory to `packages/composer/src/Clip.ts`

3. **Export WindBuilder** from `packages/composer/src/index.ts`

4. **Create tests** in `packages/composer/src/__tests__/WindBuilder.test.ts`

## Notes
- Reuse CCOperation type from Task 025
- CC2 = Breath Controller
- CC11 = Expression Controller
- Amount is normalized 0-1, scale to 0-127 for MIDI

## Files
- `packages/composer/src/clips/WindBuilder.ts` (create)
- `packages/composer/src/Clip.ts` (add wind factory)
- `packages/composer/src/index.ts` (add export)
- `packages/composer/src/__tests__/WindBuilder.test.ts` (create)

## Acceptance
- [ ] `WindBuilder` class extends SynapticMelody
- [ ] `breath(0.8)` queues CC2 = 102 (floor(0.8 * 127))
- [ ] `expressionCC(0.5)` queues CC11 = 63 (floor(0.5 * 127))
- [ ] Validates amount is 0-1 range
- [ ] `Clip.wind('name')` factory works
- [ ] Tests pass
- [ ] No TODO/FIXME comments
- [ ] No console.log statements
