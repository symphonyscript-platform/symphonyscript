# Task 052: Implement Vibrato via Pitch Bend LFO

**Priority:** HIGH  
**Category:** Dead Code Fix  
**Status:** Open  
**Created:** 2026-02-06  
**Source:** Composer Audit C-002

---

## Problem

`vibrato()` method stores state but never consumes it. Users call the method expecting pitch modulation, but no effect occurs.

## Current State

```typescript
// clips/SynapticClip.ts:366-370
vibrato(rate: number, depth: number): this {
    this.vibratoRate = rate;    // NEVER READ
    this.vibratoDepth = depth;  // NEVER READ
    return this;
}
```

## Required Implementation

### Vibrato LFO Emission

When a note is flushed with vibrato active, emit pitch bend events forming a sine wave:

```typescript
// SynapticClip.ts
private emitVibratoLFO(tick: number, duration: number): void {
    if (this.vibratoRate <= 0 || this.vibratoDepth <= 0) return;
    
    const cyclesPerBeat = this.vibratoRate;
    const ticksPerCycle = 480 / cyclesPerBeat;
    const maxBend = Math.round((this.vibratoDepth / 2) * 8192);
    
    for (let t = 0; t < duration; t += sampleInterval) {
        const phase = (t / ticksPerCycle) * 2 * Math.PI;
        const bendValue = Math.round(Math.sin(phase) * maxBend);
        this.operations.push({ kind: 'pitchBend', value: bendValue, tick: tick + t });
    }
    
    // Reset at end
    this.operations.push({ kind: 'pitchBend', value: 0, tick: tick + duration });
}
```

### Integration with flushNote

```typescript
flushNote(...): void {
    // ... existing logic ...
    
    if (this.vibratoRate > 0 && this.vibratoDepth > 0) {
        this.emitVibratoLFO(tick, duration);
    }
}
```

### Add vibratoOff Method

```typescript
vibratoOff(): this {
    this.vibratoRate = 0;
    this.vibratoDepth = 0;
    return this;
}
```

## Files to Modify

- `[MODIFY] packages/composer/src/clips/SynapticClip.ts`
- `[NEW] packages/composer/src/__tests__/Vibrato.test.ts`

## Acceptance Criteria

- [ ] `vibrato(5, 0.5).note('C4', 480)` emits pitch bend events
- [ ] Pitch bend values oscillate (positive and negative)
- [ ] Pitch bend resets to 0 at note end
- [ ] `vibratoOff()` stops vibrato for subsequent notes
- [ ] Rate controls oscillation frequency
- [ ] Depth controls pitch bend amplitude
- [ ] New `Vibrato.test.ts` passes
