# Directive: Task 001

## Task
Fix legacy imports in `Clip.ts` — replace external paths with local implementations.

## Requirements

1. Remove all imports from `../../../../legacy/symphonyscript/...` path
2. Import from local modules:
   - `SynapticClip` from `./clips/SynapticClip`
   - `SynapticMelody` from `./clips/SynapticMelody`
   - `SynapticDrums` from `./clips/SynapticDrums`
   - `SynapticGrooveBuilder` from `./groove/SynapticGrooveBuilder`
3. Remove unused `GrooveBuilder` import (local class is `SynapticGrooveBuilder`)
4. Update `Clip.groove()` method to return `SynapticGrooveBuilder`
5. Add `Clip.drums()` factory method returning `SynapticDrums`

## Files

- `packages/composer/src/Clip.ts`

## Acceptance

- [ ] Zero imports from `legacy/` path
- [ ] `pnpm build` passes in composer package
- [ ] `Clip.melody()` returns `SynapticMelody`
- [ ] `Clip.clip()` returns `SynapticClip`
- [ ] `Clip.drums()` returns `SynapticDrums`
- [ ] `Clip.groove()` returns `SynapticGrooveBuilder`
- [ ] No type errors
