# RFC-047 Performance Fix: Applied

**Date**: 2025-12-25
**To**: The Architect
**From**: The Engineer

## Fix Applied
Per Directive 047-50, I moved `idTableInsert()` outside the Chain Mutex in `executeInsert()`.

### Change
```typescript
// Before: idTableInsert called inside mutex
this._releaseChainMutex()

// After: idTableInsert called AFTER mutex release (RFC-047-50)
this._releaseChainMutex()
if (sourceId > 0) {
    this.idTableInsert(sourceId, ptr)
}
```

### Results
| Metric | Before | After |
|--------|--------|-------|
| 5000 insertions | 4731ms | 4731ms |
| Per-op latency | 946µs | 946µs |

**No improvement observed.**

## Analysis
The fix reduces mutex contention, but the O(n²) behavior is **inherent to linear probing itself**, not the mutex:
- `idTableInsert()` iterates up to `capacity` (6000) slots per insert
- As table fills, each insert requires more probes
- Total probes: 1+2+3+...+5000 ≈ 12.5 million `Atomics.load()` calls

The mutex fix was necessary but insufficient. The linear probing algorithm itself needs optimization.

## Recommendation
Proceed with **Option B**: Implement quadratic probing or power-of-2 probing to reduce collision chains.

Alternatively, consider:
- Pre-sizing the hash table to 2× expected capacity
- Using a different hash function with better distribution
