# Task 062: Refactor One-Shot Methods to Direct-to-Kernel

**Priority:** HIGH  
**Category:** Zero-Allocation Remediation  
**Status:** Open  
**Created:** 2026-02-08  
**Source:** Composer & Kernel Remediation Plan

---

## Problem

One-shot methods like `transpose()`, `tempo()`, `cc()` may still have intermediate state storage or allocations instead of firing directly to Kernel.

## Current State

```typescript
// SynapticClip.ts
tempo(bpm: number): this {
    this.sessionTempo = bpm;  // ❌ Stores locally
    return this;
}

cc(controller: number, value: number): this {
    this.operations.push({...});  // ❌ Pushes to array
    return this;
}
```

## Required Implementation

One-shot methods must write immediately to Kernel:

```typescript
// SynapticClip.ts

transpose(semitones: number): this {
    this._transpose = semitones;  // Local primitive (OK, used by flushNote)
    return this;
}

tempo(bpm: number): this {
    Atomics.store(this.bridge.sab, HDR.BPM, bpm);  // Direct to Kernel
    return this;
}

cc(controller: number, value: number): this {
    this.bridge.insertAsync(OPCODE.CC, controller, value, this.currentTick);
    return this;
}

pitchBend(value: number): this {
    this.bridge.insertAsync(OPCODE.BEND, value, 0, this.currentTick);
    return this;
}

rest(duration: number): this {
    this.currentTick += duration;  // Just advance tick (no Kernel write needed)
    return this;
}
```

## Files to Modify

- `[MODIFY] packages/composer/src/clips/SynapticClip.ts`
- `[MODIFY] packages/composer/src/clips/SynapticMelody.ts`
- `[MODIFY] packages/composer/src/clips/SynapticDrums.ts`

## Dependencies

- **Depends on:** Task 058 (Operations array must be removed first)
- **Depends on:** Task 060 (Kernel backpressure must be in place)

## One-Shot Method Inventory

| Method | Action |
|--------|--------|
| `transpose(n)` | Store in `_transpose` (used by `flushNote`) |
| `tempo(bpm)` | `Atomics.store(sab, HDR.BPM, bpm)` |
| `cc(num, val)` | `bridge.insertAsync(OPCODE.CC, ...)` |
| `pitchBend(val)` | `bridge.insertAsync(OPCODE.BEND, ...)` |
| `rest(dur)` | Advance `currentTick` |
| `swing(amount)` | Store in `_swing` primitive |
| `humanize(vel, timing)` | Store in `_humVel`, `_humTiming` primitives |
| `quantize(grid)` | Store in `_quantizeGrid` primitive |
| `scale(root, mode)` | Store in `_scaleRoot`, `_scaleMode` primitives |
| `key(root, mode)` | Store in `_keyRoot`, `_keyMode` primitives |

## Acceptance Criteria

- [ ] All one-shot methods either write to Kernel or store in primitives
- [ ] No object allocations (`{}`) in any one-shot method
- [ ] No `operations.push()` calls
- [ ] Methods that affect future notes store state in primitives
- [ ] Methods that emit events (CC, Bend) write directly to Kernel
- [ ] `pnpm build && pnpm test` passes
