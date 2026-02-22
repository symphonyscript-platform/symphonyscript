# Task 064: Refactor SynapticMelody Chord/Voicing Methods

**Priority:** CRITICAL  
**Category:** Zero-Allocation Remediation  
**Status:** Open  
**Created:** 2026-02-08  
**Source:** Composer & Kernel Remediation Plan - Gap Analysis

---

## Problem

`SynapticMelody` chord and voicing methods allocate arrays:
- `chordSymbolToPitches()` returns `number[]`
- `findBestVoicing()` returns `number[]`
- `voiceLead()` allocates `let previousVoicing: number[] = []`

## Current State

```typescript
// SynapticMelody.ts
private chordSymbolToPitches(symbol: string): number[] {
    // ... returns new array every call
    return pitches;  // ❌ Array allocation
}

private findBestVoicing(basePitches: number[], previousVoicing: number[]): number[] {
    // ... returns new array for best voicing
    return bestVoicing;  // ❌ Array allocation
}

voiceLead(numerals: string[], options?: { duration?: number }): this {
    let previousVoicing: number[] = [];  // ❌ Array allocation
    for (const numeral of numerals) {
        // ...
    }
}
```

## Required Implementation

Use pre-allocated buffers:

```typescript
// Pre-allocated buffers in class
private readonly _chordBuffer = new Int8Array(12);  // Max 12 notes per chord
private readonly _voicingBuffer = new Int8Array(12);
private readonly _prevVoicingBuffer = new Int8Array(12);
private _chordLen = 0;
private _voicingLen = 0;
private _prevVoicingLen = 0;

// Refactored methods write to buffers instead of returning arrays
private chordSymbolToPitches(symbol: string): number {
    // Writes to _chordBuffer, returns length
    this._chordLen = ...;
    return this._chordLen;
}

private findBestVoicing(prevLen: number): number {
    // Reads from _chordBuffer, writes to _voicingBuffer
    this._voicingLen = ...;
    return this._voicingLen;
}
```

## Files to Modify

- `[MODIFY] packages/composer/src/clips/SynapticMelody.ts`

## Dependencies

- **Depends on:** Task 058 (Operations array must be removed)

## Acceptance Criteria

- [ ] `chordSymbolToPitches()` writes to pre-allocated buffer
- [ ] `findBestVoicing()` writes to pre-allocated buffer
- [ ] `voiceLead()` uses pre-allocated buffers instead of `let` arrays
- [ ] No `number[]` allocations in chord/voicing hot paths
- [ ] `pnpm build && pnpm test` passes
