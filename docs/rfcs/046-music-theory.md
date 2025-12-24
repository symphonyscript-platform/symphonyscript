# RFC-060: The Music Theory Standard Library

| Metadata | Value |
| :--- | :--- |
| **Title** | **Operation Mozart: The Music Theory Standard Library** |
| **Status** | **DRAFT** |
| **Target** | `packages/theory/` |
| **Goals** | Extract algorithmic intelligence into a pure, platform-agnostic library. |
| **Depends On** | RFC-045 (Architecture Split) |

---

## 1. Executive Summary

SymphonyScript currently embeds its "Musical Intelligence" (Chord Parsing, Voice Leading, Scale Quantization) deeply within its execution runtimes (`legacy` VM and `core` Linker).

This RFC proposes the creation of **`@symphonyscript/theory`**, a dedicated, zero-dependency package for music theory logic. This cleanly separates the **"Composer"** (Math/Logic) from the **"Performer"** (Audio/Silicon).

**The Mission:**
1. **Move, Extract, Salvage and Harvest from legacy** the high-value algorithmic IP from `packages/theory/legacy` (Voice Leading, Advanced Chords, `euclidean` generators, `groove` templates, `scale` definitions, etc.).
2. **Purify** the code to remove all AST, Compiler, and Audio Engine dependencies, allocating or otherwise inefficient patterns not compatible with our high-performance, zero-alloc kernel.

---

## 2. The Architectural Split

| Domain | Package                  | Responsibility | Characteristics |
| :--- |:-------------------------| :--- | :--- |
| **The Performer** | `@symphonyscript/kernel` | Time, Audio, Memory, Concurrency | Mutable, Stateful. |
| **The Composer** | `@symphonyscript/theory` | Harmony, Rhythm, Pitch, Sets | **Platform-Agnostic**, Pure Functions, Immutable. |

### 2.1. The "Pure Math" Constraint
The `theory` package must adhere to strict purity rules:
* **Zero Runtime Dependencies:** No references to DOM, WebAudio, or Node.js built-ins.
* **Primitive Inputs/Outputs:** Functions accept and return `number` (MIDI), `string` (Note Names), or POJOs (Plain Old JS Objects).
* **No Side Effects:** No global state, no singletons.

---

## 3. Package Structure

We have initialized `packages/theory`. We need to structure it in the following way:

```text
packages/theory/
├── src/
│   ├── chords/          # Parsing, identification, and voicing
│   │   ├── parser.ts    # [FROM LEGACY] Regex-based symbol parsing
│   │   ├── dict.ts      # [FROM CORE] Chord quality definitions
│   │   └── voicing.ts   # [FROM CORE] Interval expansion logic
│   ├── harmony/         # Context-aware logic
│   │   ├── voice-leading.ts # [FROM LEGACY] The detailed cost-function algorithm
│   │   └── progression.ts   # [FROM CORE] Standard progression maps
│   ├── scales/          # Pitch sets and quantization
│   │   ├── scales.ts    # [FROM CORE] Scale definitions
│   │   └── quantize.ts  # [FROM CORE] "Snap-to-key" logic
│   ├── rhythm/          # Temporal patterns
│   │   ├── euclidean.ts # [FROM CORE] Bjorklund's algorithm
│   │   └── grooves.ts   # [FROM CORE] MPC Swing templates
│   └── pitch/           # Low-level utilities
│       └── midi.ts      # [FROM CORE] Frequency <-> MIDI conversions
├── package.json         # "sideEffects": false
└── tsconfig.json        # strict: true, "types": []
```

As your **Senior Systems Architect**, I stand corrected.

**You are right.** The files `packages/core/src/generators/euclidean.ts` and `packages/core/src/groove/templates.ts` are indeed fully implemented and production-ready. My previous scan flagged them incorrectly.

**This is actually good news.** It means we have **Double Redundancy**, and we can choose the cleanest implementation.

* **Euclidean:** The `core` version is modern and typed. We will use this one.
* **Grooves:** The `core` version has the MPC swing logic. We will use this one.

Here is the **Final, Corrected RFC-060**. It prioritizes moving the *modern* implementations from `core` over the `legacy` ones where duplicates exist.

### Action: Save this as `docs/rfc/060-theory-standard-library.md`

```markdown
# RFC-060: The Music Theory Standard Library (Operation Mozart)

| Metadata | Value |
| :--- | :--- |
| **Title** | **Operation Mozart: The Music Theory Standard Library** |
| **Status** | **APPROVED FOR IMPLEMENTATION** |
| **Target** | `packages/theory/` |
| **Goals** | Extract algorithmic intelligence into a pure, platform-agnostic library. |
| **Depends On** | RFC-045 (Architecture Split) |

---

## 1. Executive Summary

SymphonyScript currently fragments its "Musical Intelligence" across `legacy` (deep math) and `core` (modern types/generators).

This RFC authorizes the creation of **`@symphonyscript/theory`**: a unified, zero-dependency "Brain" for musical logic.

**The Strategy:**
* **Harvest from Core:** Take the modern `euclidean` generators, `groove` templates, and `scale` definitions.
* **Salvage from Legacy:** Take the complex `VoiceLeading` and `Chord Parsing` (Regex) engines which are missing or incomplete in Core.
* **Purify:** Ensure the resulting library has zero dependencies on the Audio Engine or Compiler.

---

## 2. Package Structure

We will initialize `packages/theory` with the following modular structure:

```text
packages/theory/
├── src/
│   ├── chords/          # Parsing, identification, and voicing
│   │   ├── parser.ts    # [FROM LEGACY] Regex-based symbol parsing
│   │   ├── dict.ts      # [FROM CORE] Chord quality definitions
│   │   └── voicing.ts   # [FROM CORE] Interval expansion logic
│   ├── harmony/         # Context-aware logic
│   │   ├── voice-leading.ts # [FROM LEGACY] The detailed cost-function algorithm
│   │   └── progression.ts   # [FROM CORE] Standard progression maps
│   ├── scales/          # Pitch sets and quantization
│   │   ├── scales.ts    # [FROM CORE] Scale definitions
│   │   └── quantize.ts  # [FROM CORE] "Snap-to-key" logic
│   ├── rhythm/          # Temporal patterns
│   │   ├── euclidean.ts # [FROM CORE] Bjorklund's algorithm
│   │   └── grooves.ts   # [FROM CORE] MPC Swing templates
│   └── pitch/           # Low-level utilities
│       └── midi.ts      # [FROM CORE] Frequency <-> MIDI conversions
├── package.json         # "sideEffects": false
└── tsconfig.json        # strict: true, "types": []

```

---

## 4. The Migration Manifest

### 4.1. The Rhythm Section (Source: Core)

* **Move** `theory/src/legacy/generators/euclidean.ts` -> `theory/src/rhythm/euclidean.ts`.
* **Move** `theory/src/legacy/groove/templates.ts` -> `theory/src/rhythm/grooves.ts`.
* *Note:* Ensure `grooves.ts` exports simple data structures, not `GrooveTemplate` objects if they depend on Core types.



### 4.2. The Chord Engine (Source: Mixed)

* **Parser:** Port `theory/src/legacy/chords/parser.ts`. The legacy regex engine is superior and handles complex extensions (`Cmaj7#11`).
* **Definitions:** Port `theory/src/legacy/chords/definitions.ts`.
* **Resolver:** Rewrite `resolver.ts` to use the Legacy Parser but output Core-compatible numerical arrays.

### 4.3. Harmony & Voice Leading (Source: Legacy)

* **Voice Leading:** Port `theory/src/legacy/theory/voiceleading.ts`.
* **Refactor:** Strip all `AST` and `Compiler` types.
* **Signature:** `optimize(chords: number[][]): number[][]`.



### 4.4. Scales & Pitch (Source: Core)

* **Move** `theory/src/legacy/scales/` and `theory/src/legacy/theory/keys.ts` -> `theory/src/scales/`.
* **Move** `theory/src/legacy/util/midi.ts` -> `theory/src/pitch/midi.ts`.

---

## 5. Integration Plan

1. **Execute Moves:** Perform the file moves/copies defined above.
2. **Do not touch dependencies:** Keep theory/src/legacy for now, for reference.


---
