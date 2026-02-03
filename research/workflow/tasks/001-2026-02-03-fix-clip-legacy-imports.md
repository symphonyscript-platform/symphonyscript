# Task 001: Fix Legacy Imports in Clip.ts

**Priority:** CRITICAL  
**Category:** Build Health  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit

---

## Problem

`Clip.ts` imports from a non-existent legacy path, causing build failure.

## Location

```
packages/composer/src/Clip.ts:7-9
```

## Evidence

```typescript
import { SynapticClip } from '../../../../legacy/symphonyscript/packages/composer/src/legacy-synaptic/SynapticClip'
import { SynapticMelody } from '../../../../legacy/symphonyscript/packages/composer/src/legacy-synaptic/SynapticMelody'
import { GrooveBuilder } from '../../../../legacy/symphonyscript/packages/composer/src/legacy-synaptic/GrooveBuilder'
```

## Build Error

```
error TS2305: Module has no exported member 'VoiceAllocator'
error TS2511: Cannot create instance of an abstract class
error TS2339: Property 'addNote' does not exist on type 'SynapticNode'
(+ 6 more errors from legacy path)
```

## Impact

- Package cannot compile
- All downstream code blocked
- Tests cannot run

## Remediation

Replace legacy imports with local implementations:

```typescript
import { SynapticMelody } from './clips/SynapticMelody'
import { SynapticDrums } from './clips/SynapticDrums'
import { SynapticGrooveBuilder } from './groove/SynapticGrooveBuilder'
```

Update the `Clip` factory class to use these implementations.

## Acceptance Criteria

- [ ] `pnpm build` passes in composer package
- [ ] No imports from `legacy/` path
- [ ] `Clip.melody()`, `Clip.drums()`, `Clip.groove()` return correct types
