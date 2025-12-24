# RFC-047: The 24-Bit Theory & Bitwise Polyphony Architecture

| Metadata | Value |
| --- | --- |
| **Title** | **24-Bit Theory & Bitwise Polyphony Architecture** |
| **Status** | **PLANNING** |
| **Target** | `packages/theory/`, `packages/composer/`, `packages/synaptic/` |
| **Goals** | Zero Allocations, Microtonal Precision, Native Polyphony, Fluent DX |
| **Depends On** | RFC-044 (Command Ring) |

---

## 1. Executive Summary

Current music theory libraries rely on heavy object allocation (arrays of strings) and 12-TET assumptions, making them unsuitable for the SymphonyScript Kernel (`Silicon`).

RFC-047 proposes a **"Bitwise Theory"** architecture:

1.  **24-EDO Integer Masks**: Harmony is represented as a single 32-bit integer relative to a root, enabling native microtonality (Quarter Tones) and zero-allocation processing.
2.  **Hybrid Polyphony**:
    *   **Bitwise (Vertical)**: Block chords are atomic integer masks.
    *   **Stack (Horizontal)**: Counterpoint is handled via a lightweight graph branching mechanism (`.stack()`).
3.  **Phase-Locked Kernel**: The scheduler guarantees mathematical time-alignment across infinite loops.

**Result**: The Music Theory engine becomes a set of CPU-native integer operations, while the Composer DSL remains highly expressive and fluent.

---

## 2. The Physics Problem

In a real-time audio system, allocating objects (like `['C', 'E', 'G']`) causes Garbage Collection spikes.

*   **The Old Way (Objects):** Theory logic returns Arrays. Kernel iterates Arrays. GC pauses Audio.
*   **The New Way (Integers):** Theory logic returns `Int32`. Kernel typically uses CTZ (Count Trailing Zeros) instructions. Zero GC.

Additionally, "Polyphony" is often confused with "Multi-threading". In SymphonyScript, Polyphony matches the Linked List topology of the Synaptic Graph.

---

## 3. Data Structures & Memory Layout

### 3.1. The 24-Bit Microtonal Integer
We utilize 24 bits of a 32-bit integer to represent intervals in a **24-EDO** (Quarter Tone) grid.

**Grid**: 1 Octave = 24 steps (increment = 50 cents).

| Bit | Interval | Semitones | Note (Ref C) |
| --- | --- | --- | --- |
| `0` | Perfect Unison | 0 | C |
| `1` | Quarter Sharp | 0.5 | C+ |
| `2` | Minor Second | 1.0 | Db |
| ... | ... | ... | ... |
| `8` | Major Third | 4.0 | E |
| `14` | Perfect Fifth | 7.0 | G |
| `23` | Max Interval | 11.5 | B+ |

**Mask Example (Major Triad):**
```typescript
// Bits 0, 8, 14 set
const MAJOR = (1 << 0) | (1 << 8) | (1 << 14); // 0x4101
```

### 3.2. Polyphony Models

**Model A: The Atomic Block (Bitwise)**
*   **Use Case**: Standard Chords (Homophonic).
*   **Data**: One `SynapticNode`.
*   **Payload**: `Root (Midi)` + `Mask (Int24)`.

**Model B: The Stack Graph (Linked List Branching)**
*   **Use Case**: Counterpoint / Independent Voices.
*   **Structure**:
    ```text
          /-> Node B (Voice 1) ->\
    Node A                        -> Node D
          \-> Node C (Voice 2) -/
    ```
*   **Implementation**: Done at Composition time via `SynapticClip.stack()`.

---

## 4. The Composer Protocol

### 4.1. The Fluent Groove DSL
We adopt an immutable Builder pattern for Groove templates to replace legacy config objects.

```typescript
// Definition
const mpc = Clip.groove()
  .swing(0.55)
  .steps(4)
  .build();

// Application
Clip.melody()
  .use(mpc)
  .swing(0.2) // Inline override
```

### 4.2. Semantic Timing API
We distinguish between Content, Micro-timing, and Scheduling.

*   **`cursor.rest(duration)`**: **Structural**. Inserts silence. Advances Cursor.
*   **`cursor.shift(ticks)`**: **Micro-timing**. Offsets the next event's start tick. Does NOT advance Cursor.
*   **`clip.wait(duration)`**: **Scheduling**. Delays the Clip's launch at runtime.
*   **`clip.playbackOffset(ms)`**: **Latency**. Compensates for hardware output delay.

---

## 5. Architectural Implications

### 5.1. Consistency Model
*   **Bitwise Purity**: The Kernel ONLY understands integers. Strings ('C#') must be resolved by `@symphonyscript/theory` before reaching the bridge.
*   **Phase Locking**: The Kernel scheduler ignores "history" and calculates playback position as `Time % LoopLength`. This guarantees eventual synchronization even after CPU dropouts.

### 5.2. Safety Mechanisms
1.  **Mask Overflow**: If a chord spans >1 Octave, it must be handled by the Packer (wrapping or splitting).
    *   *Strategy*: Theory library automatically wraps bits (Mod 24) or returns a Split Stack if voicing requires it.

---

## 6. Implementation Plan

### Phase 1: Theory Core (`@symphonyscript/theory`)
1.  **Scaffold**: Initialize package structure.
2.  **`constants.ts`**: Define `INTERVALS` (0-23) and `CHORD_MASKS`.
3.  **`packer.ts`**: Implement `pack(intervals)` and `unpack(mask)`.
4.  **`definitions.ts`**: Port `legacy/chords` to `CHORD_MASKS`.

### Phase 2: Composer Polyphony (`@symphonyscript/composer`)
1.  **`SynapticClip.ts`**: Implement `.stack(fn)` and `.voice(id)`.
2.  **`GrooveBuilder.ts`**: Implement the Fluent Builder.
3.  **Offsets**: Implement `.shift()` and `.rest()` logic.

### Phase 3: Kernel Engine (`@symphonyscript/kernel`)
1.  **Scheduler**: Implement Phase-Locking.
2.  **Voice Allocator**: Bitmask iteration.

---

## 7. Architect's Note
This architecture moves Music Theory from "Art" to "Math". By enforcing integer rigidity at the core, we enable infinite flexibility at the edge. "Turing-Complete Polyphony" is achieved not by a single complex node, but by the composition of simple atomic primitives.

**Ratification Status:** FINAL.
**Courage Level:** HIGH.
