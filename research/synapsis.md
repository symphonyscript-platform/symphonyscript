# Synaptic Architecture 2.0: The Deterministic Animation of Music

**Status:** APPROVED DESIGN  
**Date:** 2026-02-03  
**RFC:** 050 (Supersedes previous probabilistic models)

---

## 1. The Core Philosophy: "Breathing Determinism"

**The Pivot:**
We reject "Airport Music" (randomness/dice-rolling).
We embrace **"Interactive Animation"** (deterministic response to inputs).

**The Definition:**
SymphonyScript is a **Responsive Music Engine**.
*   **The Graph** defines the *possibilities* (Composition).
*   **The Weights** define the *sensitivities* (Animation).
*   **The Parameters** define the *reality* (Context).

**Why "Synaptic"?**
The term remains accurate because the system is built on **Nodes** (Clips) connected by **Synapses** (Edges). Signals propagate through these connections based on signal strength (Weights). This mimics a neural network's topology, even if the firing rules are deterministic logic gates rather than probabilistic rolls.

---

## 2. The Unification: Everything is Modulatable

We reject the idea that "Routing" is special.
Routing is just **Volume Modulation** applied to a connection.

Therefore, we unify the architecture:
**Every Property is a Signal.**

*   **Volume:** Signal amplitude.
*   **Tempo:** Signal rate.
*   **Pitch:** Signal frequency.
*   **Routing:** Signal gate (0 = blocked, 1000 = open).

All properties accept a **Base Value** and an optional **Animation**.

---

## 3. The Protocol: Standardized Parameters

To ensure determinism and zero-allocation safety, we enforce a strict parameter protocol.

### 3.1. The Normalized Range (0-1000)
All parameters must be normalized integers in the range `0` to `1000`.
*   `0` = Min / False / Off
*   `1000` = Max / True / On
*   `500` = Midpoint

**Why?**
1.  **Optimization:** Fits in `Int32` or `Int16`. Fast math.
2.  **Predictability:** No `float` rounding errors in critical logic.
3.  **Standardization:** All systems (Game, UI, Kernel) speak the same language.

### 3.2. User Responsibility
The User (Developer) is responsible for mapping domain values (e.g., "Health: 50/100") to the Synaptic Range (500) *before* passing it to the Session. The Kernel does not know what "Health" is. It only knows `PARAM_ID_100 = 500`.

---

## 4. The API: Fluent, Declarative, Immutable

We reject allocations (closures/arrow functions) in the definition path to ensure serializability to the Kernel. We use a **Fluent Math Builder**.

### 4.1. The `modulate()` Pattern
We use `.modulate()` instead of `.animate()` to distinguish "Changing a Property" (Modulation) from "Time-Based Transition" (Animation). Modulation implies *control*.

**Syntax:**
```typescript
const c1 = Clip.melody()
  .note('C4')
  .velocity(v => v
      .base(0.7) // Default
      .modulate(myAnimation, 'Intensity') // Apply animation driven by 'Intensity'
  )
```

### 4.2. The Animation Definition (`Synapse.animation`)
Animations are reusable **Logic Blocks**. They transform an Input Parameter (0-1000) into a Multiplier (0.0-1.0+).

**The Math Builder:**
Instead of `x => x * 2`, we use a chainable API.

```typescript
const aggressiveCurve = Synapse.animation()
  .keyframe(0, 0)      // At param 0, output 0
  .keyframe(500, 0.2)  // At param 500, output 0.2 (Slow start)
  .keyframe(1000, 1.0) // At param 1000, output 1.0
  .ease('easeInQuad')  // Interpolation logic
```

**Logic Builder:**
For discrete logic (If-Else replacement):

```typescript
const gateLogic = Synapse.animation()
  .lessThan(500, 0)    // If param < 500, output 0 (Mute)
  .otherwise(1)        // Else, output 1 (Play)
```

**Complex Math:**
```typescript
const complex = Synapse.animation()
  .input()             // Start with param value
  .divide(1000)        // Normalize to 0-1
  .power(2)            // Square it (Exponential)
```

---

## 5. Composition Structure: Content vs. Cell

We maintain a semantic distinction between **Content** and **Structure**, even though both use the same underlying modulation mechanism.

### 5.1. `Clip.melody()` / `Clip.drums()` (Content)
*   **Purpose:** Generate notes.
*   **Modulation:** Used for Expression (Velocity, Pitch, Timbre).
*   **"Play Softly"**: Modulating velocity.

### 5.2. `Clip.cell()` (Structure)
*   **Purpose:** Routing and Topology.
*   **Modulation:** Used for Form (Branching, Layering).
*   **"Play Instead"**: Modulating synapse weights (Routing).

**The Cell API:**
```typescript
const mainFlow = Clip.cell('MainFlow')
  .play(verse)       // Standard playback
  .synapse(chorus)   // Connection to next node
    .weight(1000)    // Base weight
    .modulate(transitionCurve, 'SongProgress') // Dynamic routing
```

---

## 6. Implementation Strategy

### Phase 4 (Current)
1.  **Fix Imports:** Unblock the build (`Task 001`).
2.  **Base Classes:** Ensure `SynapticClip` supports the `.synapse()` method.
3.  **Kernel Tables:** Ensure `SYNAPSE_TABLE` supports the weight field (already done).

### Phase 5 (Modulation)
1.  **Math Builder:** Implement `Synapse.animation()` builder that serializes to a Kernel-readable format (Bytecode or Lookup Table).
2.  **Kernel Runtime:** Implement the `evaluateAnimation()` function in `SiliconBridge` / `AudioWorklet`.
3.  **Parameter Table:** Add `PARAMETER_TABLE` to SharedArrayBuffer.

---

## 7. Why this wins
1.  **Deterministic:** No dice. Same input = Same output.
2.  **Serializable:** Entire song logic can be saved to JSON/Binary.
3.  **Zero-Alloc:** Logic runs on pre-allocated tables/arrays.
4.  **Expressive:** Supports Curves, Logic, and Math without writing JS code in the audio thread.
5.  **Professional:** Fits the mental model of Game Audio (Wwise/FMOD) but code-first.
