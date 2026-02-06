# Implementation: Task 051

Files: SynapticClip.ts, SynapticChordCursor.ts, SynapticMelodyNoteCursor.ts
Build: FAIL (pre-existing errors only, Task 051 code compiles)
Tests: SKIPPED (build broken)

## Pre-existing Build Errors (out of scope)

```
src/clips/SynapticClip.ts(767): Property 'dynamicsPoints' does not exist
src/clips/SynapticClip.ts(805): Property 'dynamicsPoints' does not exist
src/clips/SynapticMelody.ts(644): missing 'override' modifier
```

## Implementation

### SynapticClip.ts
- Added `ArpPattern` import
- Added fields: `_arpeggioPattern`, `_arpeggioRate`, `_arpeggioGate`
- Updated `arpeggio()` signature: `ArpPattern | null`
- Added setters: `arpeggioRate()`, `arpeggioGate()`
- Added getters: `getArpeggioPattern()`, `getArpeggioRate()`, `getArpeggioGate()`

### SynapticChordCursor.ts
- Added chord-level override fields: `_arpPattern`, `_arpRate`, `_arpGate`
- Added setters: `arpeggio()`, `arpeggioRate()`, `arpeggioGate()`
- Added `applyArpPattern()` with all 7 patterns
- Modified `commit()`: resolves arpeggio settings (chord > clip), emits sequentially if arpeggiated

### SynapticMelodyNoteCursor.ts
- Updated `arpeggio()` signature to `ArpPattern | null`

Awaiting hostile review.
