# Directive: Task 023

## Task
Implement Roman numeral chord methods for SynapticMelody.

## Requirements

1. **Add `roman()` method** to `SynapticMelody`:
   ```typescript
   roman(numeral: string, duration?: number): SynapticChordCursor {
       // Requires key() context
       // Convert numeral → chord symbol using romanToChord()
       // Delegate to chord()
   }
   ```

2. **Add `progression()` method** to `SynapticMelody`:
   ```typescript
   progression(numerals: string[], options?: { duration?: number }): this {
       // Emit sequence of roman numeral chords
       // Each chord uses specified or default duration
   }
   ```

3. **Import from `@symphonyscript/theory`**:
   - Use `romanToChord` from `packages/theory/src/harmony/progressions.ts`
   - Need to create key adapter (composer's KeyContext → theory's KeyContext with Interval24EDO root)

4. **Create key adapter** in `packages/composer/src/utils/romanAdapter.ts`:
   - Convert string root (e.g., 'G') to Interval24EDO (14 for G)
   - Wrap `romanToChord` with string-based KeyContext

5. **Create tests** in `packages/composer/src/__tests__/roman.test.ts`

## Files
- `packages/composer/src/clips/SynapticMelody.ts` (add methods)
- `packages/composer/src/utils/romanAdapter.ts` (create)
- `packages/composer/src/__tests__/roman.test.ts` (create)

## Acceptance
- [ ] `roman('I')` returns chord cursor with root chord
- [ ] `roman('ii')` returns minor chord cursor
- [ ] `roman('V7')` returns dominant 7th chord cursor
- [ ] `progression(['I', 'IV', 'V', 'I'])` emits 4 chords
- [ ] Throws if `key()` not set
- [ ] Works with different keys (C major, G major, etc.)
- [ ] Tests pass
- [ ] No TODO/FIXME comments
- [ ] No console.log statements
