# Contributing to SymphonyScript

## Creating a Notation Package

SymphonyScript uses a pluggable notation system. The built-in `@symphonyscript/notations` provides Western notation, but community packages can provide alternative systems (Arabic maqam, Indian raga, Javanese gamelan, etc.).

### How it works

1. **Implement the `Notation` interface** — extend `BaseNotation` from `@symphonyscript/core`.
2. **Export your class** — consumers instantiate it and pass it to the bridge.
3. **Augment the type registry** — use TypeScript declaration merging so central cues like `note()` gain autocomplete for your notation's note names.

### Step 1: Implement `BaseNotation`

```ts
import { BaseNotation } from '@symphonyscript/core'
import { NotationInputError } from '@symphonyscript/core'

export class MaqamNotation extends BaseNotation {
  getId() { return 'maqam-arabic' }
  getName() { return 'Arabic Maqam' }
  getTuningHz() { return 440 }
  // ... implement all abstract methods
}
```

`BaseNotation` provides free implementations for `noteToMidi`, `noteToFrequency`, `transposeNote`, and `isEnharmonic` — derived from your `noteToCents()` and `centsToNote()`.

### Step 2: Augment the Type Registry (Declaration Merging)

SymphonyScript uses a central `note()` cue that accepts note names from any installed notation. To enable autocomplete for your notation, augment the `NoteNameRegistry` interface in `@symphonyscript/core`.

Create a `.d.ts` file in your package that augments the registry:

```ts
// src/types.d.ts (ships with your package)
declare module '@symphonyscript/core' {
  interface NoteNameRegistry {
    'maqam-arabic': `${'rast' | 'bayati' | 'saba' | 'hijaz' | 'nahawand'}${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`
  }
}
```

When a user installs your package, TypeScript merges your note names into the global `NoteName` type. The central `note()` cue will autocomplete your note names alongside any other installed notations.

**How users consume it:**

```ts
import { MaqamNotation } from 'symphonyscript-maqam'

// Types load automatically when the package is imported.
// Or explicitly via triple-slash reference:
/// <reference types="symphonyscript-maqam" />

const bridge = new BaseCompositionBridge({
  notation: new MaqamNotation(),
})

// note() now autocompletes maqam note names
note('rast4')  // ✅ type-safe
```

### Step 3: Error Contract

All methods must follow this error contract:

| Scenario | Error class | Meaning |
|----------|-------------|---------|
| Invalid input | `NotationInputError` | "I support this, but your input is wrong" |
| Unsupported feature | `NotationUnsupportedError` | "My notation doesn't support this" |

No method returns `null`. All methods either succeed or throw.

Check `getCapabilities()` to determine if a notation supports chords, degrees, or progressions before calling those methods.

### Template literal type tips

- Keep combinatorics reasonable (under ~1000 variants) to avoid slowing the TS language server.
- Use descriptive union members, not overly generic patterns.
- Test your `.d.ts` by importing it in a scratch file and verifying autocomplete works.
