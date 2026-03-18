# @symphonyscript/theory — Full Audit

## Structure Overview

```
src/
├── index.ts                     # Barrel — re-exports all 6 modules
├── pitch/                       # MIDI constants, drums, interval functions
│   ├── midi.ts                  # MIDI_CC, GM_PROGRAM, velocity converters
│   ├── intervals.ts             # IntervalQuality type, getIntervalQuality(), invertInterval(), isEnharmonic()
│   └── drums.ts                 # 47 GM drum constants in cents (NEW — from this session)
├── harmony/                     # Voice leading, accidentals
│   ├── types.ts                 # Accidental, VoiceLeadingStyle, ScaleDegree, ProgressionOptions
│   └── voiceleading.ts          # voiceMovementCost(), closeVoicing(), openVoicing(), drop2Voicing(), voiceLead(), voiceLeadProgression(), pitchToInterval(), pitchToOctave(), createPitch()
├── rhythm/                      # Duration, euclidean, grooves, articulation, quantize, tempo
│   ├── types.ts                 # Velocity, ArpPattern, TimeSignatureString, validators
│   ├── duration.ts              # StandardDuration/DottedDuration/TripletDuration types, DURATION constant, parseDuration(), beatsToSeconds(), etc
│   ├── euclidean.ts             # euclidean(), rotatePattern(), patternToString()
│   ├── grooves.ts               # GrooveStep/GrooveTemplate types, GROOVE presets, createSwing(), applyGroove(), getGrooveTiming/Velocity/Duration()
│   ├── articulation.ts          # Articulation type, ARTICULATION_MULTIPLIER/VELOCITY, getArticulationMultiplier/Velocity()
│   ├── quantize.ts              # QuantizeMode, TimeSignature, 18+ beat-grid functions (getNextBeat, getNextBarBeat, getCurrentBar, getBeatInBar, etc)
│   └── tempo.ts                 # TempoCurve, EasingCurve, TempoKeyframe, TempoEnvelope types, createTempoKeyframe/Envelope()
├── effects/                     # Audio effects type system
│   └── types.ts                 # EffectType, 7 effect param interfaces, EffectParamsFor<T>, InsertEffect, SendConfig, EffectBusConfig, factories
├── continuous/                  # Cent-based pitch model
│   ├── intervals.ts             # Interval constant object (Unison→Octave), ratioToCents()
│   ├── scales.ts                # 22 scale constants (IONIAN_INTERVALS through PHRYGIAN_DOMINANT), degreeToCents()
│   ├── chords.ts                # ChordIntervals type, CHORD_INTERVALS object (30+ chord types)
│   └── temperament.ts           # Temperament type, 4 presets (equal, just, pythagorean, meantone), resolveTemperament()
├── util/                        # Data structures and helpers
│   ├── heap.ts                  # MinHeap<T> class, createNumberHeap(), createMaxHeap()
│   └── random.ts                # SeededRandom class (Mulberry32), createRandom(), hashString(), combineSeed()
└── __tests__/                   # 7 test files
    ├── continuous.test.ts
    ├── continuous-chords.test.ts
    ├── continuous-scales.test.ts
    ├── intervals.test.ts
    ├── types.test.ts
    ├── util.test.ts
    └── velocity.test.ts
```

---

## Module-by-Module Breakdown

### 1. [pitch/](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer/src/builders/DrumHitBuilder.ts#81-91) — MIDI & Drums

| Export | Kind | File | Notes |
|---|---|---|---|
| `MIDI_CC` | const object | midi.ts | 31 standard CC numbers |
| `GM_PROGRAM` | const object | midi.ts | 128 GM program numbers (0-indexed) |
| [midiVelocityToNormalized()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/pitch/midi.ts#252-266) | function | midi.ts | MIDI 0-127 → normalized 0-1 |
| [normalizedToMidiVelocity()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/pitch/midi.ts#267-281) | function | midi.ts | Normalized 0-1 → MIDI 0-127 |
| [IntervalQuality](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/pitch/intervals.ts#18-19) | type | intervals.ts | `'P' \| 'M' \| 'm' \| 'A' \| 'd'` |
| [getIntervalQuality()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/pitch/intervals.ts#38-96) | function | intervals.ts | Semitones + generic → quality |
| [invertInterval()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/pitch/intervals.ts#97-112) | function | intervals.ts | Complement within octave |
| [isEnharmonic()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/core/src/interfaces/notation.ts#147-158) | function | intervals.ts | Same pitch class check |
| 47 drum constants | const (flat) | drums.ts | `BASS_DRUM_1 = 3600`, etc. |

### 2. [harmony/](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer/src/cues/harmony.ts#5-37) — Voice Leading & Types

| Export | Kind | File | Notes |
|---|---|---|---|
| [Accidental](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/harmony/types.ts#14-15) | type | types.ts | `'sharp' \| 'flat' \| 'natural'` |
| [VoiceLeadingStyle](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/harmony/voiceleading.ts#18-19) | type | types.ts, voiceleading.ts | Duplicated! `'close' \| 'open' \| 'drop2'` |
| [ProgressionOptions](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/harmony/types.ts#28-34) | interface | types.ts | voiceLead + style options |
| [ScaleDegree](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/harmony/types.ts#42-50) | interface | types.ts | degree + alteration + octaveOffset |
| `ACCIDENTALS` | const array | types.ts | Frozen validation array |
| `VOICE_LEADING_STYLES` | const array | types.ts | Frozen validation array |
| [isAccidental()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/harmony/types.ts#71-82) | function | types.ts | Type guard |
| [isVoiceLeadingStyle()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/harmony/types.ts#83-94) | function | types.ts | Type guard |
| [VoiceLeadOptions](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/harmony/voiceleading.ts#23-31) | interface | voiceleading.ts | voices, style, centerOctave |
| [VoiceMovement](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/harmony/voiceleading.ts#35-43) | interface | voiceleading.ts | from, to, distance in cents |
| [voiceMovementCost()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/harmony/voiceleading.ts#48-92) | function | voiceleading.ts | Total movement distance |
| [closeVoicing()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/harmony/voiceleading.ts#97-139) | function | voiceleading.ts | Close voicing from intervals |
| [openVoicing()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/harmony/voiceleading.ts#140-165) | function | voiceleading.ts | Open voicing (alternating octave) |
| [drop2Voicing()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/harmony/voiceleading.ts#166-197) | function | voiceleading.ts | Drop-2 voicing |
| [voiceLead()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/harmony/voiceleading.ts#202-253) | function | voiceleading.ts | Single chord transition |
| [voiceLeadProgression()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/harmony/voiceleading.ts#254-285) | function | voiceleading.ts | Multi-chord voice leading |
| [pitchToInterval()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/harmony/voiceleading.ts#352-362) | function | voiceleading.ts | Pitch → interval within octave |
| [pitchToOctave()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/harmony/voiceleading.ts#363-373) | function | voiceleading.ts | Pitch → octave number |
| [createPitch()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/harmony/voiceleading.ts#374-385) | function | voiceleading.ts | Interval + octave → absolute pitch |

### 3. [rhythm/](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer/src/cues/melody.ts#160-182) — Duration, Patterns, Grooves, Quantization

| Export | Kind | File | Notes |
|---|---|---|---|
| [StandardDuration](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/duration.ts#15-16) | type | duration.ts | `'1n' \| '2n' \| '4n' \| '8n' \| '16n' \| '32n'` |
| [DottedDuration](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/duration.ts#20-21) | type | duration.ts | `'1n.' \| '2n.' \| '4n.' \| '8n.' \| '16n.'` |
| [TripletDuration](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/duration.ts#25-26) | type | duration.ts | `'2t' \| '4t' \| '8t' \| '16t'` |
| [NoteDuration](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/core/src/registries.ts#50-51) | type | duration.ts | Union of above + number |
| [ParsedTimeSignature](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/duration.ts#35-39) | interface | duration.ts | numerator + denominator |
| `DURATION` | const object | duration.ts | WHOLE, HALF, QUARTER, etc. string constants |
| [parseDuration()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/duration.ts#141-192) | function | duration.ts | Duration string → beats |
| [getDurationBeats()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/duration.ts#193-206) | function | duration.ts | With fallback |
| [durationToMs()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/duration.ts#207-221) | function | duration.ts | Duration + BPM → ms |
| [isValidDuration()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/duration.ts#222-233) | function | duration.ts | Validation |
| [beatsToSeconds()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/duration.ts#86-98) | function | duration.ts | beats × (60/bpm) |
| [secondsToBeats()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/quantize.ts#156-168) | function | duration.ts | seconds × (bpm/60) |
| [parseTimeSignature()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/duration.ts#116-136) | function | duration.ts | String → {numerator, denominator} |
| [euclidean()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/euclidean.ts#11-58) | function | euclidean.ts | Bjorklund's algorithm |
| [rotatePattern()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/euclidean.ts#63-82) | function | euclidean.ts | Rotate boolean array |
| [patternToString()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/euclidean.ts#87-104) | function | euclidean.ts | Boolean[] → 'x--x' |
| [GrooveStep](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/grooves.ts#15-23) | interface | grooves.ts | timing, velocity, duration multipliers |
| [GrooveTemplate](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/grooves.ts#27-32) | interface | grooves.ts | name, stepsPerBeat, steps |
| `GROOVE` | const object | grooves.ts | STRAIGHT, MPC_16_55/57/60/66/75, SWING, LAID_BACK, RUSHING |
| [createSwing()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/grooves.ts#37-71) | function | grooves.ts | MPC-style swing generator |
| [applyGroove()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/grooves.ts#142-169) | function | grooves.ts | Get timing+velocity for step |
| `getGrooveTiming/Velocity/Duration()` | functions | grooves.ts | Individual groove accessors |
| [Articulation](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/articulation.ts#15-16) | type | articulation.ts | 5 types |
| `ARTICULATION_MULTIPLIER` | const object | articulation.ts | Duration multipliers per articulation |
| `ARTICULATION_VELOCITY` | const object | articulation.ts | Velocity multipliers per articulation |
| `getArticulationMultiplier/Velocity()` | functions | articulation.ts | Lookup with fallback |
| [isArticulation()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/articulation.ts#81-92) | function | articulation.ts | Type guard |
| [QuantizeMode](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/quantize.ts#15-16) | type | quantize.ts | `'bar' \| 'beat' \| 'off'` |
| [TimeSignature](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/quantize.ts#20-24) | interface | quantize.ts | beatsPerMeasure + beatUnit |
| 18+ quantize functions | functions | quantize.ts | Beat-grid calculations, lookahead, audio time sync |
| [TempoCurve](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/tempo.ts#14-19) | type | tempo.ts | linear, ease-in, ease-out, ease-in-out |
| [EasingCurve](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/tempo.ts#23-31) | type | tempo.ts | 7 curve types |
| `TempoKeyframe/Envelope` | interfaces | tempo.ts | Tempo automation |
| `createTempoKeyframe/Envelope()` | functions | tempo.ts | Factories with validation |
| [Velocity](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/types.ts#14-15) | type | types.ts | Just `number` alias |
| [ArpPattern](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/types.ts#23-31) | type | types.ts | 7 arp directions |
| [TimeSignatureString](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/types.ts#39-40) | type | types.ts | Template literal `${number}/${number}` |
| Validation functions | functions | types.ts | isArpPattern, isTimeSignatureString, isValidVelocity |

### 4. `effects/` — Audio Effects Type System

| Export | Kind | File | Notes |
|---|---|---|---|
| [EffectType](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/effects/types.ts#14-23) | type | types.ts | 8 effect types |
| 7 param interfaces | interfaces | types.ts | ReverbParams, DelayParams, etc. |
| `EffectParamsFor<T>` | conditional type | types.ts | Maps EffectType → params |
| `InsertEffect<T>` | interface | types.ts | type + params |
| [SendConfig](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/effects/types.ts#174-180) | interface | types.ts | bus + amount |
| [EffectBusConfig](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/effects/types.ts#184-190) | interface | types.ts | name + effects chain |
| [FilterType](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/effects/types.ts#117-118) | type | types.ts | lowpass, highpass, bandpass |
| Validation + factories | functions | types.ts | isEffectType, createInsertEffect, createSendConfig, etc. |

### 5. `continuous/` — Cent-Based Pitch Model

| Export | Kind | File | Notes |
|---|---|---|---|
| [Interval](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/core/src/registries.ts#13-14) | const object | intervals.ts | 13 interval constants (Unison→Octave, all in cents) |
| [ratioToCents()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/continuous/intervals.ts#26-46) | function | intervals.ts | Frequency ratio → cents |
| 22 scale constants | const (flat) | scales.ts | IONIAN_INTERVALS, DORIAN_INTERVALS, etc. |
| [degreeToCents()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer/src/__tests__/test-utils.ts#157-166) | function | scales.ts | (intervals, degree) → cent offset. Handles octave wrapping. |
| [ChordIntervals](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/continuous/chords.ts#26-27) | type | chords.ts | `readonly number[]` |
| `CHORD_INTERVALS` | const object | chords.ts | 30+ chord types as cent arrays |
| [Temperament](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/continuous/temperament.ts#22-23) | type | temperament.ts | `readonly number[]` |
| [TemperamentName](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/continuous/temperament.ts#25-26) | type | temperament.ts | 4 preset names |
| 4 temperament presets | const arrays | temperament.ts | EQUAL, JUST, PYTHAGOREAN, MEANTONE |
| `DEFAULT_TEMPERAMENT` | const | temperament.ts | Alias for EQUAL |
| [resolveTemperament()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/continuous/temperament.ts#118-148) | function | temperament.ts | Name or array → Temperament |

### 6. `util/` — Data Structures

| Export | Kind | File | Notes |
|---|---|---|---|
| `MinHeap<T>` | class | heap.ts | Generic min-heap with comparator |
| [createNumberHeap()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/util/heap.ts#159-168) | function | heap.ts | Factory for numeric min-heap |
| [createMaxHeap()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/util/heap.ts#169-178) | function | heap.ts | Factory for numeric max-heap |
| [SeededRandom](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/util/random.ts#15-173) | class | random.ts | Mulberry32 PRNG with full API |
| [createRandom()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/util/random.ts#174-185) | function | random.ts | Factory with optional seed |
| [hashString()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/util/random.ts#186-203) | function | random.ts | String → uint32 hash |
| [combineSeed()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/util/random.ts#204-227) | function | random.ts | Multi-value seed derivation |

---

## Structural Issues

1. **Inconsistent naming**: [pitch/intervals.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/pitch/intervals.ts) vs [continuous/intervals.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/continuous/intervals.ts) — two files both dealing with intervals but completely different content
2. **Duplicate type**: [VoiceLeadingStyle](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/harmony/voiceleading.ts#18-19) defined in both [harmony/types.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/harmony/types.ts) AND [harmony/voiceleading.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/harmony/voiceleading.ts)
3. **Duplicate functions**: [beatsToSeconds](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/duration.ts#86-98)/[secondsToBeats](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/quantize.ts#156-168) exist in BOTH [rhythm/duration.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/duration.ts) AND [rhythm/quantize.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/quantize.ts) (aliased on re-export)
4. **Duplicate [parseTimeSignature](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/duration.ts#116-136)**: exists in both [rhythm/duration.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/duration.ts) and [rhythm/quantize.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/quantize.ts) with slightly different return types
5. **Mixed concerns in [pitch/](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer/src/builders/DrumHitBuilder.ts#81-91)**: MIDI CC constants, GM programs, velocity converters, AND interval theory functions all in the same module
6. **Flat drum exports**: 47 individual constants instead of a grouped namespace
7. **Flat scale exports**: 22 individual `X_INTERVALS` constants instead of grouped
8. **No note pitch constants**: No `C4 = 4800` type exports
9. **No degree constants**: No `Degree.I = 1` type exports
10. **`effects/` is pure types**: No actual DSP logic, just interfaces — arguably belongs in core, not theory
11. **`util/` is infrastructure**: MinHeap and SeededRandom are generic data structures, not music theory
12. **[quantize.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/theory/src/rhythm/quantize.ts) is 415 lines**: Beat-grid quantization is more of a runtime/kernel concern than music theory
