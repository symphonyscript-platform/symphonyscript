# Directive: Task 047

Implement `voiceLead()` for voice-led chord progressions on `SynapticMelody`.

## Context

Legacy ref: `packages/legacy/src/clip/MelodyBuilder.ts` — `voiceLead(numerals, options)` generates chords with minimal voice motion between successive chords.

## Requirements

1. Implement `voiceLead(numerals: string[], options?: { duration?: number }): this` on `SynapticMelody`
   - Requires key context (throw if not set)
   - Parse roman numerals to chords (reuse existing `roman()` logic)
   - For each successive chord, find voicing that minimizes total pitch movement from previous chord
   - Emit notes via `chord().commit()` internally
2. Voice leading algorithm: for each chord after the first, try all inversions and pick the one with smallest sum of absolute pitch differences
3. First chord uses root position

## Files

- `packages/composer/src/clips/SynapticMelody.ts` (add voiceLead)
- `packages/composer/src/__tests__/VoiceLead.test.ts` (create)

## Acceptance Criteria

- [ ] `voiceLead(['I', 'IV', 'V', 'I'])` generates voice-led progression
- [ ] Requires key context
- [ ] Minimizes voice movement between chords
- [ ] Duration option works
- [ ] Tests pass
