# Directive: Task 022

## Task
Implement key signature context for automatic accidentals in SynapticMelody.

## Requirements

1. **Add `KeyContext` type** to `packages/composer/src/types.ts`:
   ```typescript
   export interface KeyContext {
       root: string;       // 'C', 'G', 'Bb', etc.
       mode: 'major' | 'minor';
   }
   
   export type Accidental = 'sharp' | 'flat' | 'natural';
   ```

2. **Add key context state** to `SynapticClip`:
   - `protected keyContext: KeyContext | null = null`
   - `protected nextAccidental: Accidental | null = null`

3. **Implement `key()` method** in `SynapticClip`:
   ```typescript
   key(root: string, mode: 'major' | 'minor'): this {
       this.keyContext = { root, mode };
       return this;
   }
   ```

4. **Implement `accidental()` method** in `SynapticClip`:
   ```typescript
   accidental(acc: Accidental): this {
       this.nextAccidental = acc;
       return this;
   }
   ```

5. **Modify `SynapticMelodyNoteCursor.note()`** to apply key signature:
   - Import `applyKeySignature` from `@symphonyscript/theory` (legacy/theory module)
   - Before parsing pitch, apply key signature transformation
   - Consume `nextAccidental` after use (reset to null)

6. **Create tests** in `packages/composer/src/__tests__/key.test.ts`

## Reference
Use existing implementation in `packages/theory/src/legacy/theory/keys.ts`:
- `applyKeySignature(noteName, keyContext, overrideAccidental)` 

## Files
- `packages/composer/src/types.ts` (add KeyContext, Accidental)
- `packages/composer/src/clips/SynapticClip.ts` (add state + methods)
- `packages/composer/src/cursors/SynapticMelodyNoteCursor.ts` (apply key signature)
- `packages/composer/src/__tests__/key.test.ts` (create)

## Acceptance
- [ ] `key('G', 'major')` sets key context
- [ ] `note('F4')` becomes F#4 in G major
- [ ] `accidental('natural').note('F4')` stays F4 in G major
- [ ] `accidental('sharp').note('C4')` becomes C#4
- [ ] `accidental('flat').note('B4')` becomes Bb4
- [ ] Accidental is consumed after one note
- [ ] Notes with explicit accidentals (`F#4`) are not modified
- [ ] Tests pass
- [ ] No TODO/FIXME comments
- [ ] No console.log statements
