# Implementation: Task 003

## Changes
- `packages/composer/src/SymphonyEngine.ts`:
  - Added null check after `createLinkerSAB()` at line 67-69
  - Throws descriptive error: `'Failed to create SharedArrayBuffer for kernel'`

## Verify
```
cd packages/composer && pnpm exec tsc --noEmit 2>&1 | grep "SymphonyEngine"
```
Output: No errors for SymphonyEngine.ts

## Pre-existing Error (outside scope)
- `silicon-bridge.ts:1786` — Kernel package null-check issue (separate task)
