# RFC-053: Generic SynapticNode Architecture

## Goal Description
Implement the "Generic Neuron" vision where `SynapticNode` serves as the fundamental, content-agnostic unit of the SymphonyScript topology. It abstracts connectivity (`linkTo`, `connect`) and identity (`entryId`, `exitId`) from the musical content (managed by `SynapticClip` and other future subclasses). This enables a uniform graph where any node can connect to any other, regardless of its internal logic.

## Proposed Changes

### Package: `@symphonyscript/composer`

#### [NEW] [SynapticNode.ts](https://github.com/tsomaia/symphonyscript/blob/main/packages/composer/src/core/SynapticNode.ts)
- Abstract base class.
- Holds `SiliconBridge` reference.
- Manages `entryId` and `exitId` (protected access, public getters).
- Implements `linkTo(target: SynapticNode, weight?: number, jitter?: number)`.
- Implements `connect(target: SynapticNode)` (alias).

#### [MODIFY] [SynapticClip.ts](https://github.com/tsomaia/symphonyscript/blob/main/packages/composer/src/clips/SynapticClip.ts)
- Extend `SynapticNode`.
- Remove `bridge`, `entryId`, `exitId` from `SynapticClip` (inherit them).
- Remove `linkTo` (inherit it).
- Update constructors to pass `bridge` to `super()`.

#### [MODIFY] [SynapticMelody.ts](https://github.com/tsomaia/symphonyscript/blob/main/packages/composer/src/clips/SynapticMelody.ts)
- Ensure compliance with new hierarchy.

#### [MODIFY] [SynapticDrums.ts](https://github.com/tsomaia/symphonyscript/blob/main/packages/composer/src/clips/SynapticDrums.ts)
- Ensure compliance with new hierarchy.
