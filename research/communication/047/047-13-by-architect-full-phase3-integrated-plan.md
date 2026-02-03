# RFC-047 Phase 3: ARCHITECT GUIDANCE (FINAL INTEGRATED)

**Date**: 2025-12-25T07:09:10+04:00  
**Reviewer**: Architect (Zero-Trust Policy)  
**Status**: **FINAL APPROVED DIRECTIVE**  
**Previous Guidance**: 047-11/12 RESCINDED

---

## EXECUTIVE SUMMARY

This directive establishes the **Final Architectural Decision** for Phase 3. 
**Core Philosophy**: The Kernel is a physics engine, not a music theory engine. It manages concurrency, time, and signal paths, but knows nothing of "Chords" or "Harmony".

---

## 1. Architectural Structure (Flat & Integrated)

**Decision**:
- **Kernel remains Theory-Agnostic**.
- **NO new directories**. Use flat structure in `packages/kernel/src/`.
- **Logic Placement**:
    - **Scheduling Math**: `packages/kernel/src/scheduler.ts` (Pure utility).
    - **Voice Allocation**: **MOVED TO** `packages/synaptic/src/voice-allocator.ts`. (Wait, confirmed: Voice Allocator logic lives in Synaptic/Composer layer to keep Kernel dumb).

### File Plan:
```
packages/kernel/src/
├── scheduler.ts        [NEW] - getModulatedTime() utility
└── silicon-bridge.ts   [MODIFY] - Packs MPE bits

packages/synaptic/src/
├── SynapticNode.ts     [MODIFY] - Adds expressionId, cycle
└── VoiceAllocator.ts   [NEW] - Unpacks HarmonyMask -> addNote() calls
```

---

## 2. MPE Implementation (Zero-Overhead)

**Decision**:
- **Bit-Packing Strategy**: Use specific bits in the existing `PACKED_A` flags byte.
- **Allocation**: Bits 4-7 (High nibble of LSByte).
- **Capacity**: 16 channels (0-15).
- **Impact**: Zero memory increase. `NODE_SIZE` remains 32 bytes.

**Constants Update (`packages/kernel/src/constants.ts`)**:
```typescript
export const FLAG = {
  ACTIVE: 0x01,
  MUTED: 0x02,
  DIRTY: 0x04,
  // NEW: Packed Expression ID (4 bits: 0-15)
  EXPRESSION_SHIFT: 4,
  EXPRESSION_MASK: 0xF0
} as const
```

---

## 3. Harmony API (`.harmony()` vs `.chord()`)

**Decision**: 
- **`.chord()`**: High-level, String-based, allocates arrays. (Existing).
- **`.harmony()`**: Low-level, Bitwise/Integer-based, Zero-Allocation.

### Specification: `clip.harmony(mask, root, duration?)`

- **Parameters**:
    - `mask` (number): 24-bit HarmonyMask (e.g., `MASKS.MAJOR_TRIAD`). **NO STRINGS ALLOWED.**
    - `root` (number): MIDI Root Pitch (e.g., `60`). **NO STRINGS ALLOWED.**
    - `duration` (number): Ticks (optional).
- **Behavior**:
    1.  Validates inputs (Pure integers only).
    2.  Instantiates/uses `VoiceAllocator`.
    3.  Unpacks `mask` using `@symphonyscript/theory`.
    4.  Calls `this.addNote()` N times (once per interval).
- **Documentation Requirement**: Clearly document that this is the "Machine Language" method for algorithmic/generative use, offering zero-allocation performance.

```typescript
// Example Implementation
harmony(mask: number, root: number, duration?: number): this {
   // Pure integer path - FAST
   VoiceAllocator.allocate(mask, root, (pitch) => {
       this.note(pitch, duration);
   });
   return this;
}
```

---

## 4. Phase-Locking API (`.cycle()`)

**Decision**:
- **API**: `clip.cycle(ticks)`.
- **Semantics**: Sets the `loopLength` property of the generated nodes.
- **Kernel Logic**:
    - `scheduler.ts` implements `getModulatedTime(tick, cycle)`.
    - `tick % cycle` (if cycle < Infinity).
    - Used by `AudioWorklet` (future) or playback emulators to ensure phase-locked sync.

---

## 5. Implementation Checklist

1.  **Modify `constants.ts`**: Add `FLAG.EXPRESSION_MASK`.
2.  **Create `kernel/src/scheduler.ts`**: Implement `getModulatedTime` (pure math).
3.  **Modify `silicon-bridge.ts`**: Update `insertAsync` to pack expression ID into flags.
4.  **Create `synaptic/src/VoiceAllocator.ts`**: Implement mask unpacking (importing `theory`).
5.  **Modify `SynapticNode.ts`**: Add `expressionId` and `cycle` fields/params.
6.  **Modify `SynapticClip.ts`**: Implement `.harmony()` (pure) and `.cycle()`.
7.  **Tests**:
    - `scheduler.test.ts`: Verify modulo math.
    - `VoiceAllocator.test.ts`: Verify mask expansion.
    - `harmony.test.ts`: Verify interactions (mocked bridge).

---

**Architect Signature**: Zero-Trust Reviewer  
**Timestamp**: 2025-12-25T07:09:10+04:00  
**Status**: APPROVED TO IMPLEMENT
