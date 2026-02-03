# Implementation: Task 001

## Changes
- `packages/composer/src/Clip.ts`:
  - Removed all legacy imports from `../../../../legacy/symphonyscript/...`
  - Added imports from local modules: `./clips/SynapticMelody`, `./clips/SynapticDrums`, `./groove/SynapticGrooveBuilder`
  - Added null check for `SiliconSynapse.create()` return value (line 36-38)
  - Updated `Clip.groove()` to return `SynapticGrooveBuilder`
  - Added `Clip.drums()` factory method returning `SynapticDrums`
  - Removed `Clip.clip()` method (see note below)

## Design Decision: Removed `Clip.clip()`
`SynapticClip` is an abstract class (`clips/SynapticClip.ts:5`). The original `Clip.clip()` attempted to instantiate it directly, which TypeScript correctly rejects. Since no concrete "generic clip" exists, the method was removed. Users should use `Clip.melody()` or `Clip.drums()` for concrete builders.

## Acceptance Criteria Status
- [x] Zero imports from `legacy/` path
- [x] `Clip.melody()` returns `SynapticMelody`
- [x] `Clip.drums()` returns `SynapticDrums`
- [x] `Clip.groove()` returns `SynapticGrooveBuilder`
- [x] No type errors in `Clip.ts`
- [ ] `Clip.clip()` returns `SynapticClip` — REMOVED (abstract class cannot be instantiated)

## Verify
```
cd packages/composer && pnpm exec tsc --noEmit 2>&1 | grep "Clip.ts"
```
Output: No errors for Clip.ts

## Pre-existing Errors (outside Task 001 scope)
- `SymphonyEngine.ts:69` — `SharedArrayBuffer | null` issue (Task 003)
- `silicon-bridge.ts:1786` — Kernel null-check issue (separate package)

## Awaiting
Architect decision on `Clip.clip()` removal.
