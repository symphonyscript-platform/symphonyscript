# K-004 Implementation Plan: Hashing Divergence

**Target**: Unify hashing logic between Kernel (`SiliconSynapse`, `SynapseAllocator`) and Bridge (`SiliconBridge`).
**Strategy**: Standardize on `KNUTH_HASH_CONST` (Golden Ratio Multiplicative Hash).
**Scope**: `packages/kernel/src/silicon-bridge.ts`, `packages/kernel/src/constants.ts`
**Author**: Antigravity

## 1. Problem Statement
`SiliconBridge.generateSourceId` uses a custom hash: `((fileHash * 31 + line) * 31 + col)`.
Kernel components use `KNUTH_HASH_CONST` (`2654435761`) for integer hashing (Source ID -> Slot).

These are slightly different problems (String->Int vs Int->Int), but the Bridge is producing the "Source ID" which is effectively the "Primary Key". The randomness/distribution of this ID matters.

## 2. Proposed Solution
Update `SiliconBridge.generateSourceId` to use a robust Integer Hashing strategy for combining `fileHash`, `line`, and `col`, preferably using the Knuth constant to disperse bits better than `* 31`.

**New Logic:**
```typescript
import { KNUTH_HASH_CONST } from './constants'

private generateSourceId(fileHash: number, line: number, col: number): number {
    // Combine fields using standard mixing
    // Use Knuth constant instead of 31 for better dispersion
    let hash = fileHash
    hash = (hash ^ line) * KNUTH_HASH_CONST
    hash = (hash ^ col) * KNUTH_HASH_CONST
    
    // Ensure positive and 31-bit (SMI compliant)
    return hash >>> 1 
}
```

## 3. Risks
**Backwards Compatibility**: This changes all Source IDs. 
- Existing project files that store `sourceId` will break (links won't resolve).
- **Mitigation**: User explicitly stated "Do not worry about backwards compatibility".

## 4. Verification
1.  **Unit Tests**: Verify `generateSourceId` returns deterministic results.
2.  **Collision Check**: Add test case with similar file/line/col combinations to ensure no trivial collisions.
