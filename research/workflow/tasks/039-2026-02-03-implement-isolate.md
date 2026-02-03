# Task 039: Implement isolate() for Scope Isolation

**Priority:** LOW  
**Category:** Missing Feature  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit - Feature Gap

---

## Problem

No way to isolate tempo/dynamics changes to a scope.

## Current State

No `isolate()` method exists.

## Legacy Reference

```typescript
// packages/legacy/src/clip/ClipBuilder.ts:312-339
isolate(options: ScopeIsolation, builderFn: (b: this) => this | NoteCursor<this>): this {
    const innerContext = this._createEmptyClone('IsolateContext')
    const result = builderFn(innerContext)
    const innerContent = (result instanceof NoteCursor) ? result.commit() : result
    const operations = innerContent._params.chain?.toArray() ?? []
    
    return this.addOp({
        kind: 'scope',
        isolate: options,
        operation: { kind: 'clip', clip: {...} }
    })
}

interface ScopeIsolation {
    tempo?: boolean
    dynamics?: boolean
    timeSignature?: boolean
}
```

## Required Implementation

1. Add `ScopeIsolation` type
2. Add `ScopeOp` type
3. Implement `isolate(options, builderFn)` on SynapticClip
4. Add escape method to cursor

## Example

```typescript
melody
    .tempo(120)
    .isolate({ tempo: true }, c => c
        .tempo(180)  // Only affects this scope
        .note('C4').commit()
    )
    .note('D4').commit()  // Back to 120 BPM
```

## Acceptance Criteria

- [ ] `isolate({ tempo: true }, fn)` works
- [ ] Tempo restored after scope
- [ ] Dynamics isolation works
- [ ] Time signature isolation works
- [ ] Tests for isolate
