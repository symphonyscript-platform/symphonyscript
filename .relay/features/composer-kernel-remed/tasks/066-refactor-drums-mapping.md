# Task 066: Refactor SynapticDrums Drum Map Handling

**Priority:** HIGH  
**Category:** Zero-Allocation Remediation  
**Status:** Open  
**Created:** 2026-02-08  
**Source:** Composer & Kernel Remediation Plan - Gap Analysis

---

## Problem

`SynapticDrums` uses object spread for drum mapping:
- Constructor: `this._drumMap = { ...DEFAULT_DRUM_MAP }`
- `withMapping()`: `this._drumMap = { ...this._drumMap, ...mapping }`

## Current State

```typescript
// SynapticDrums.ts
protected _drumMap: DrumMap = { ...DEFAULT_DRUM_MAP };  // ❌ Object allocation

withMapping(mapping: DrumMap): this {
    this._drumMap = { ...this._drumMap, ...mapping };  // ❌ Object allocation
    return this;
}
```

## Required Implementation

Use a pre-allocated typed array for drum mapping:

```typescript
// Pre-allocate drum map as typed array
// Index = drum enum, Value = MIDI pitch
private readonly _drumPitches = new Uint8Array(16);  // 16 drum slots max

// Enum for drum types
const enum DrumType {
    KICK = 0,
    SNARE = 1,
    HAT = 2,
    OPENHAT = 3,
    // ...
}

// Initialize with defaults
constructor(bridge: SiliconBridge) {
    super(bridge);
    this._drumPitches[DrumType.KICK] = 36;
    this._drumPitches[DrumType.SNARE] = 38;
    this._drumPitches[DrumType.HAT] = 42;
    // ...
}

// Zero-allocation mapping override
mapDrum(drum: DrumType, pitch: number): this {
    this._drumPitches[drum] = pitch;
    return this;
}

resolveDrumPitch(drum: DrumType): number {
    return this._drumPitches[drum];
}
```

## Files to Modify

- `[MODIFY] packages/composer/src/clips/SynapticDrums.ts`
- `[MODIFY] packages/composer/src/types.ts` (add DrumType enum)

## Dependencies

- **Depends on:** Task 059 (Enums must be defined)

## Acceptance Criteria

- [ ] Drum map uses `Uint8Array` instead of object
- [ ] `withMapping()` replaced with `mapDrum(drum, pitch)`
- [ ] No object spread `{...}` in SynapticDrums
- [ ] Drum resolution is O(1) array lookup
- [ ] `pnpm build && pnpm test` passes
