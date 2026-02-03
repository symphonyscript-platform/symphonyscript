# Composer Package Task Index

**Generated:** 2026-02-03  
**Source:** Composer Audit Report  
**Total Tasks:** 43

---

## Summary by Priority

| Priority | Count | Description |
|----------|-------|-------------|
| CRITICAL | 13 | Build blockers, broken tests |
| HIGH | 6 | v1.0 blockers |
| MEDIUM | 17 | Feature parity |
| LOW | 7 | Nice to have |

---

## CRITICAL Priority (Build/Test Blockers)

### Build Fixes (3)

| # | Task | Issue |
|---|------|-------|
| 001 | [fix-clip-legacy-imports](001-2026-02-03-fix-clip-legacy-imports.md) | Legacy path imports in Clip.ts |
| 002 | [fix-clip-null-safety](002-2026-02-03-fix-clip-null-safety.md) | Null SiliconSynapse in Clip.ts |
| 003 | [fix-engine-null-safety](003-2026-02-03-fix-engine-null-safety.md) | Null SharedArrayBuffer in SymphonyEngine.ts |

### Test Fixes (10)

| # | Task | Issue |
|---|------|-------|
| 004 | [fix-test-synaptic-cursor-import](004-2026-02-03-fix-test-synaptic-cursor-import.md) | Wrong import: SynapticCursor → ComposerCursor |
| 005 | [fix-test-synaptic-node-import](005-2026-02-03-fix-test-synaptic-node-import.md) | Wrong import: ../core/SynapticNode |
| 006 | [fix-test-flush-to-commit](006-2026-02-03-fix-test-flush-to-commit.md) | Wrong method: flush() → commit() |
| 007 | [fix-test-legacy-api-voice](007-2026-02-03-fix-test-legacy-api-voice.md) | Legacy API: addNote() |
| 008 | [fix-test-legacy-api-timing](008-2026-02-03-fix-test-legacy-api-timing.md) | Legacy API: addNote() |
| 009 | [fix-test-legacy-api-groove](009-2026-02-03-fix-test-legacy-api-groove.md) | Legacy API: addNote() |
| 010 | [fix-test-legacy-api-stack](010-2026-02-03-fix-test-legacy-api-stack.md) | Legacy API: addNote() |
| 011 | [fix-test-legacy-api-harmony](011-2026-02-03-fix-test-legacy-api-harmony.md) | Missing: VoiceAllocator |
| 012 | [fix-test-legacy-api-music-os](012-2026-02-03-fix-test-legacy-api-music-os.md) | Legacy API: addNote() |
| 013 | [fix-test-drums-undefined-result](013-2026-02-03-fix-test-drums-undefined-result.md) | commit() returns undefined |

---

## HIGH Priority (v1.0 Blockers)

| # | Task | Feature |
|---|------|---------|
| 014 | [implement-build-method](014-2026-02-03-implement-build-method.md) | `build()` → ClipNode |
| 015 | [implement-loop-method](015-2026-02-03-implement-loop-method.md) | `loop(count, content)` |
| 016 | [implement-play-method](016-2026-02-03-implement-play-method.md) | `play(clip)` |
| 017 | [implement-octave-methods](017-2026-02-03-implement-octave-methods.md) | `octave()`, `octaveUp()`, `octaveDown()` |
| 018 | [implement-missing-drum-hits](018-2026-02-03-implement-missing-drum-hits.md) | `openHat()`, `crash()`, `ride()`, `tom()` |
| 019 | [implement-scale-context](019-2026-02-03-implement-scale-context.md) | `scale()`, full `degree()` |

---

## MEDIUM Priority (Feature Parity)

### Higher-Level Abstractions (2)

| # | Task | Feature |
|---|------|---------|
| 020 | [implement-track-class](020-2026-02-03-implement-track-class.md) | `Track` class |
| 021 | [implement-session-class](021-2026-02-03-implement-session-class.md) | `Session` class |

### Music Theory (3)

| # | Task | Feature |
|---|------|---------|
| 022 | [implement-key-context](022-2026-02-03-implement-key-context.md) | `key()`, auto accidentals |
| 023 | [implement-roman-numerals](023-2026-02-03-implement-roman-numerals.md) | `roman()`, `progression()` |
| 041 | [implement-degree-chord](041-2026-02-03-implement-degree-chord.md) | `degreeChord()` |

### Dynamics & Expression (3)

| # | Task | Feature |
|---|------|---------|
| 024 | [implement-dynamics](024-2026-02-03-implement-dynamics.md) | `crescendo()`, `decrescendo()` |
| 034 | [implement-aftertouch](034-2026-02-03-implement-aftertouch.md) | `aftertouch()` |
| 035 | [implement-automation](035-2026-02-03-implement-automation.md) | `automate()`, `volume()`, `pan()` |

### Specialized Builders (3)

| # | Task | Feature |
|---|------|---------|
| 025 | [implement-keyboard-builder](025-2026-02-03-implement-keyboard-builder.md) | `KeyboardBuilder` |
| 026 | [implement-wind-builder](026-2026-02-03-implement-wind-builder.md) | `WindBuilder` |
| 027 | [implement-string-builder](027-2026-02-03-implement-string-builder.md) | `StringBuilder` |

### Pattern Generators (2)

| # | Task | Feature |
|---|------|---------|
| 028 | [implement-euclidean](028-2026-02-03-implement-euclidean.md) | `euclidean()` |
| 029 | [implement-arpeggio](029-2026-02-03-implement-arpeggio.md) | `arpeggio()` |

### Clip Context (4)

| # | Task | Feature |
|---|------|---------|
| 030 | [implement-default-duration](030-2026-02-03-implement-default-duration.md) | `defaultDuration()` |
| 031 | [implement-humanize-context](031-2026-02-03-implement-humanize-context.md) | `defaultHumanize()` |
| 032 | [implement-quantize](032-2026-02-03-implement-quantize.md) | `quantize()` |
| 033 | [implement-control-cc](033-2026-02-03-implement-control-cc.md) | `control()` |

---

## LOW Priority (Nice to Have)

| # | Task | Feature |
|---|------|---------|
| 036 | [implement-voice-scope](036-2026-02-03-implement-voice-scope.md) | `voice()` for MPE |
| 037 | [implement-preview](037-2026-02-03-implement-preview.md) | `preview()` ASCII |
| 038 | [implement-freeze](038-2026-02-03-implement-freeze.md) | `freeze()`, `FrozenClip` |
| 039 | [implement-isolate](039-2026-02-03-implement-isolate.md) | `isolate()` scoping |
| 040 | [implement-custom-drum-map](040-2026-02-03-implement-custom-drum-map.md) | `withMapping()` |
| 042 | [implement-tempo-envelope](042-2026-02-03-implement-tempo-envelope.md) | `tempoEnvelope()` |
| 043 | [rename-composer-cursor](043-2026-02-03-rename-composer-cursor.md) | RFC naming compliance |

---

## Dependency Graph

```
CRITICAL (Must complete first)
├── 001 Fix Clip imports ─────────────────┐
├── 002 Fix Clip null safety ─────────────┤
├── 003 Fix Engine null safety ───────────┼─→ BUILD PASSES
├── 004 Fix SynapticCursor import ────────┤
├── 005 Fix SynapticNode import ──────────┤
├── 006 Fix flush→commit ─────────────────┼─→ TESTS PASS
├── 007-012 Fix legacy API tests ─────────┤
└── 013 Fix drums undefined ──────────────┘

HIGH (After CRITICAL)
├── 014 build() ──────────────────────────┐
├── 015 loop() ───────────────────────────┼─→ COMPOSABILITY
├── 016 play() ───────────────────────────┤
├── 017 octave methods ───────────────────┼─→ PITCH CONTROL
├── 018 drum hits ────────────────────────┼─→ DRUMS COMPLETE
└── 019 scale() ──────────────────────────┴─→ THEORY FOUNDATION

MEDIUM (After HIGH)
├── 020 Track ─────────┬──────────────────┐
├── 021 Session ───────┘                  │
├── 022 key() ─────────┬──────────────────┼─→ THEORY COMPLETE
├── 023 roman() ───────┤                  │
├── 041 degreeChord()──┘                  │
├── 024 dynamics ──────┬──────────────────┤
├── 034 aftertouch ────┤                  │
├── 035 automation ────┘                  │
├── 025-027 builders ─────────────────────┼─→ INSTRUMENT TYPES
├── 028-029 patterns ─────────────────────┼─→ GENERATION
└── 030-033 context ──────────────────────┴─→ CLIP CONTEXT

LOW (After MEDIUM or as needed)
├── 036-042 advanced features
└── 043 naming compliance
```

---

## Quick Reference

### Files to Fix (Build)
- `packages/composer/src/Clip.ts`
- `packages/composer/src/SymphonyEngine.ts`

### Files to Fix (Tests)
- `packages/composer/src/__tests__/SynapticCursor.test.ts`
- `packages/composer/src/__tests__/SynapticNode.test.ts`
- `packages/composer/src/__tests__/SynapticNoteCursor.test.ts`
- `packages/composer/src/__tests__/SynapticChordCursor.test.ts`
- `packages/composer/src/__tests__/SynapticMelodyNoteCursor.test.ts`
- `packages/composer/src/__tests__/SynapticDrums.test.ts`
- `packages/composer/src/__tests__/voice.test.ts`
- `packages/composer/src/__tests__/timing.test.ts`
- `packages/composer/src/__tests__/groove-integration.test.ts`
- `packages/composer/src/__tests__/stack.test.ts`
- `packages/composer/src/__tests__/harmony.test.ts`
- `packages/composer/src/__tests__/music-os.test.ts`

### Files to Create (New Features)
- `packages/composer/src/clips/KeyboardBuilder.ts`
- `packages/composer/src/clips/WindBuilder.ts`
- `packages/composer/src/clips/StringBuilder.ts`
- `packages/composer/src/Track.ts`
- `packages/composer/src/Session.ts`
- `packages/composer/src/types.ts` (ClipNode, operations, etc.)
