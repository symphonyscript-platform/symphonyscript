# Task 055: Add Allocation Policy Documentation

**Priority:** LOW  
**Category:** Documentation  
**Status:** Open  
**Created:** 2026-02-06  
**Source:** Composer Audit N-004

---

## Problem

Composer package uses Maps, arrays, and allocates freely. Some comments claim "KERNEL-SAFE" which could cause confusion with the actual kernel package's zero-allocation discipline.

## Current State

```typescript
// clips/SynapticClip.ts:31
protected ccAutomation: Map<number, number>;

// Various places mention "KERNEL-SAFE" but this is composer code
```

## Required Implementation

Add class-level documentation:

```typescript
/**
 * SynapticClip - Base class for musical clip builders.
 * 
 * ALLOCATION POLICY: This class runs on main thread only.
 * Maps, arrays, and object allocation are permitted here.
 * 
 * The term "KERNEL-SAFE" in this package refers to the output
 * format being compatible with kernel consumption, NOT that
 * these methods themselves are safe to call from the audio thread.
 * 
 * For actual audio-thread-safe operations, see @symphonyscript/kernel.
 */
export class SynapticClip extends SynapticNode {
```

## Files to Modify

- `[MODIFY] packages/composer/src/clips/SynapticClip.ts`

## Acceptance Criteria

- [ ] Class-level JSDoc explains allocation policy
- [ ] Distinction from kernel's zero-alloc is clear
- [ ] No code changes, documentation only
