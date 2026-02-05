# Directive: Task 025

## Task
Implement KeyboardBuilder for piano/keyboard instruments with sustain pedal support.

## Requirements

1. **Create `KeyboardBuilder`** in `packages/composer/src/clips/KeyboardBuilder.ts`:
   ```typescript
   export class KeyboardBuilder extends SynapticMelody {
       sustain(): this {
           // Queue CC64 = 127 at current tick
           return this;
       }
       
       release(): this {
           // Queue CC64 = 0 at current tick
           return this;
       }
   }
   ```

2. **Add CC operation type** to `packages/composer/src/types.ts`:
   ```typescript
   export interface CCOperation {
       kind: 'cc';
       controller: number;  // CC number (64 = sustain)
       value: number;       // 0-127
       tick: number;
   }
   ```

3. **Update ClipNode operations** to include CC operations:
   ```typescript
   operations: (NoteOperation | LoopOp | ClipOp | CCOperation)[];
   ```

4. **Add `Clip.keyboard()`** factory to `packages/composer/src/Clip.ts`

5. **Export KeyboardBuilder** from `packages/composer/src/index.ts`

6. **Create tests** in `packages/composer/src/__tests__/KeyboardBuilder.test.ts`

## Files
- `packages/composer/src/types.ts` (add CCOperation)
- `packages/composer/src/clips/KeyboardBuilder.ts` (create)
- `packages/composer/src/Clip.ts` (add keyboard factory)
- `packages/composer/src/index.ts` (add export)
- `packages/composer/src/__tests__/KeyboardBuilder.test.ts` (create)

## Acceptance
- [ ] `KeyboardBuilder` class extends SynapticMelody
- [ ] `sustain()` queues CC64 = 127
- [ ] `release()` queues CC64 = 0
- [ ] CC operations appear in build() output
- [ ] `Clip.keyboard('name')` factory works
- [ ] Tests pass
- [ ] No TODO/FIXME comments
- [ ] No console.log statements
