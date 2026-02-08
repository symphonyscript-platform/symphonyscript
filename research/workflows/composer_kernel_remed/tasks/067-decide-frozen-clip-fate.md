# Task 067: Decide FrozenClip Fate

**Priority:** HIGH  
**Category:** Architecture Decision  
**Status:** Open  
**Created:** 2026-02-08  
**Source:** Composer & Kernel Remediation Plan - Gap Analysis

---

## Problem

`FrozenClip` is fundamentally allocation-centric:
- Stores `ClipNode` which contains `operations[]`
- `toOperations()` returns `[...clipNode.operations]` (spread allocation)
- `filter()` in getters creates new arrays

In a Direct-to-Kernel world where Kernel is the source of truth, what is `FrozenClip`'s purpose?

## Current State

```typescript
// FrozenClip.ts
export class FrozenClip implements OperationsSource {
    constructor(
        public readonly clipNode: ClipNode,
        public readonly options: FreezeOptions
    ) {}

    get duration(): number {
        const noteOps = this.clipNode.operations.filter(op => op.kind === 'note');
        // ...
    }

    toOperations(): ClipOperation[] {
        return [...this.clipNode.operations];
    }
}
```

## Decision Required

### Option A: DELETE FrozenClip entirely
- Kernel state is the source of truth
- Serialization reads directly from Kernel
- No intermediate "frozen" representation needed

### Option B: REFACTOR to Kernel-based freeze
- `FrozenClip` stores a Kernel snapshot ID
- `toOperations()` reads from Kernel, not local array
- Still allocates on read, but that's acceptable for serialization

### Option C: MARK as design-time only
- Keep FrozenClip as-is
- Document clearly it's for design/export, not playback
- Accept allocations as they're not in hot path

## Files to Modify

- `[DELETE or MODIFY] packages/composer/src/clips/FrozenClip.ts`
- `[MODIFY] packages/composer/src/clips/SynapticClip.ts` (remove freeze() if deleting)
- `[MODIFY] packages/composer/src/clips/SynapticMelody.ts` (update references)

## Dependencies

- **Depends on:** Task 058 (Operations array fate determines FrozenClip fate)

## Acceptance Criteria

- [ ] Decision made: DELETE, REFACTOR, or MARK
- [ ] If DELETE: All references removed, tests updated
- [ ] If REFACTOR: Kernel-based implementation complete
- [ ] If MARK: Clear `@design-time` documentation added
- [ ] `pnpm build && pnpm test` passes
