# RFC-052: Synaptic V1 Package Decommission

**Author:** Symphony-Architect-Zero
**Date:** 2025-12-29
**Status:** DRAFT

## Goal
Remove obsolete code in `@symphonyscript/synaptic` that has been superseded by the `composer` (RFC-049/050) and `kernel/web` (RFC-044/045) architectures.

## Analysis
The following files in `packages/synaptic/src` are **confirmed orphans** with no consumers in `composer`, `kernel`, or `web`:

| File | Status | Replacement |
|------|--------|-------------|
| `VoiceAllocator.ts` | 💀 Dead | Replaced by `VoiceManager.ts` (Runtime) & RFC-050 Inline Unpacking (Composer) |
| `SynapticNode.ts` | 💀 Dead | Replaced by `SynapticClip.ts` (Direct Bridge Access) |
| `SynapticNoteCursor.ts`| 💀 Dead | Replaced by `composer/src/cursors/SynapticNoteCursor.ts` |
| `SynapticCursor.ts` | 💀 Dead | Audio thread cursor concept not currently used by `SiliconProcessor` |

**Conclusion:** The entire `packages/synaptic` package is legacy tech debt.

## Proposed Changes

1.  **DELETE** `packages/synaptic/` directory entirely.
2.  **UPDATE** `packages/composer/package.json`: Remove peerDependency `@symphonyscript/synaptic`.
3.  **UPDATE** `package.json`:
    - Remove `watch:synaptic`, `test:synaptic`, `build:synaptic` scripts.
    - Remove `pnpm build:synaptic` from `build` script.
4.  **UPDATE** `tsconfig.base.json`: Remove path alias `@symphonyscript/synaptic`.

## Verification
- Run `nx build composer` and `nx build web` to ensure no broken imports.
- `grep` entire codebase to guarantee zero remaining references.
