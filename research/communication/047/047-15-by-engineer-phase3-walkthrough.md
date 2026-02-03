# Phase 3 Kernel Polyphony Walkthrough

## 1. Overview
This phase implemented "Kernel Polyphony" infrastructure, enabling MPE (MIDI Polyphonic Expression) bit-packing in the Silicon Kernel and providing pure-integer harmony allocation tools in the Synaptic layer. Additionally, the project infrastructure was migrated from NX to **pnpm + Vite**, validating the robustness of the implementation.

## 2. Changes Implemented

### Kernel Layer (`@symphonyscript/kernel`)
- **MPE Flags**: Added `FLAG.EXPRESSION_MASK` (bits 4-7) and `FLAG.EXPRESSION_SHIFT(4)`.
- **Scheduler**: Created `scheduler.ts` with `getModulatedTime(tick, cycle)` for phase-locking logic.
- **Silicon Bridge**: Updated `insertAsync` to pack `expressionId` into the node's flag bits (zero memory overhead).
- **Exports**: Exposed `getModulatedTime` via public API.

### Synaptic Layer (`@symphonyscript/synaptic`)
- **VoiceAllocator**: Created a new class to handle:
  - Unpacking 24-bit `HarmonyMask` (from Theory package).
  - Round-robin MPE channel assignment (Channels 1-15).
- **SynapticNode**: Updated to support:
  - `expressionId` state.
  - `cycle` (phase-looping) state.
  - Passing `expressionId` to Kernel.

### Composer Layer (`@symphonyscript/composer`)
- **SynapticClip**: Added new methods:
  - `.harmony(mask, root)`: Generates polyphonic chords using `VoiceAllocator`.
  - `.cycle(ticks)`: Sets phase-locking loop length.

### Infrastructure Migration
- **Build System**: Migrated from NX to **pnpm workspaces + Vite**.
- **Test Configuration**:
  - Updated `jest.preset.js` to use absolute paths (`path.resolve(__dirname)`) for correct module mapping in nested workspaces.
  - Updated `jest.config.cjs` in all packages to leverage `.spec.swcrc.json`.

## 3. Verification

### Automated Tests
- **Kernel**: `scheduler.test.ts` ✅ **PASSED**.
  - Verified phase-locking math and modulo constraints.
- **Synaptic**: `VoiceAllocator.test.ts` ✅ **PASSED**.
  - Verified Harmony Mask unpacking and MPE channel rotation (1-15).
- **Composer**: `harmony.test.ts` ✅ **PASSED**.
  - Verified `SynapticClip.harmony()` orchestration, note chaining (linked list consistency), and single-cursor advancement.
  - Fixed mock implementations to support `getLinker()` and correct node ID chaining expectations.

### Code Verification
- **Zero Allocation**: `insertAsync` uses bitwise operations only. `voice()` uses integer state.
- **MPE Compliance**: Uses 4 bits (16 channels), matching MIDI spec.
- **Architecture**: Strict separation of concerns (Kernel = Mechanism, Synaptic = Logic, Composer = API).

## 4. Conclusion
Phase 3 is complete. The system now supports polyphonic expression (MPE) at the kernel level with zero memory overhead, and the Composer API exposes this via a fluent, theory-aware `.harmony()` method. The infrastructure is now stable on pnpm.
