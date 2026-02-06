# Directive: Task 045

Implement tritone substitution functions in the theory package.

## Requirements

1. Add to `packages/theory/src/harmony/progressions.ts` (or create if needed):
   - `tritoneSubstitute(root: string): string` — returns root 6 semitones away (e.g., G → Db)
   - `applyTritoneSubstitutions(chords: string[]): string[]` — substitutes dominant 7th chords in a progression
2. Export from harmony module
3. Zero-allocation for `tritoneSubstitute` (string lookup only)

## Acceptance Criteria

- [ ] `tritoneSubstitute('G')` returns `'Db'`
- [ ] `applyTritoneSubstitutions(['Dm7', 'G7', 'Cmaj7'])` returns `['Dm7', 'Db7', 'Cmaj7']`
- [ ] Only dominant 7th chords are substituted
- [ ] Tests created
- [ ] Build and tests pass
