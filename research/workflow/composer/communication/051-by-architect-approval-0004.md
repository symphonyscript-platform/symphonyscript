# Approval: Task 051

## Verified

- [x] `clip.arpeggio(pattern)` stores clip-level pattern
- [x] `clip.arpeggioRate(rate)` stores clip-level rate (default 0.125)
- [x] `clip.arpeggioGate(gate)` stores clip-level gate (default 0.8)
- [x] `getArpeggioPattern()`, `getArpeggioRate()`, `getArpeggioGate()` getters exposed
- [x] `chord().arpeggio(pattern)` overrides clip-level
- [x] `chord().arpeggioRate(rate)` overrides clip-level
- [x] `chord().arpeggioGate(gate)` overrides clip-level
- [x] `arpeggio(null)` at chord level disables arpeggiation
- [x] Resolution logic: `chord-level !== undefined ? chord-level : clip-level`
- [x] All 7 patterns implemented: up, down, upDown, downUp, random, converge, diverge
- [x] 'random' pattern uses seeded RNG via `clip.getSeededRng()`
- [x] No `Math.random()` in codebase
- [ ] Build succeeds — **WAIVED** (pre-existing errors unrelated)

## Next

Task 051 complete. Close the task.
