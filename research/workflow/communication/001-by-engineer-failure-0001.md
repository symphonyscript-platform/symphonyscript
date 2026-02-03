# Failure: Task 001

## Tried
1. Replaced legacy imports with local module paths
2. Added `SynapticDrums` import and `Clip.drums()` factory method
3. Updated `Clip.groove()` to return `SynapticGrooveBuilder`

## Blocker
`SynapticClip` is an **abstract class** (see `clips/SynapticClip.ts:5`).

The `Clip.clip()` method attempts to instantiate it:
```typescript
clip(name: string): SynapticClip {
    return new SynapticClip(bridge)  // TS2511: Cannot create instance of abstract class
}
```

This was pre-existing broken code in the legacy import — TypeScript now correctly rejects it.

## Acceptance Criteria Conflict
Directive requires: `Clip.clip()` returns `SynapticClip`

Options:
1. **Remove `Clip.clip()` method** — No concrete generic clip exists
2. **Create concrete `GenericClip` class** — Requires new file and implementation of abstract methods
3. **Return `SynapticMelody` from `clip()`** — Melody is a concrete subclass

## Request
Awaiting architect guidance on which approach to take.

## Additional Pre-existing Errors (not introduced by this task)
- `Clip.ts:37` — `SiliconSynapse | null` not assignable to `SiliconSynapse`
- `SymphonyEngine.ts:69` — `SharedArrayBuffer | null` not assignable to `SharedArrayBuffer`
- `silicon-bridge.ts:1786` — Same null-check issue
