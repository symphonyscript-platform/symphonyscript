# RFC-049 Compliance: Zero-Allocation Synaptic Cursor Architecture

## Goal Description
Implement the Synaptic Cursor Architecture defined in RFC-049. This is a critical architectural overhaul to ensure zero-allocation performance in the "hot path" of music generation (converting user intent to kernel events). The goal is to provide a rich, expressive API for the user while strictly adhering to zero-allocation principles (no closures, no temporary objects per note) in the underlying implementation.

## User Review Required
> [!IMPORTANT]
> **Zero-Allocation Strictness**: This implementation intentionally avoids functional patterns like `Array.forEach` or callbacks in `flush()` methods to prevent closure allocation. It uses `while` loops and bitwise operations. This style differs from standard high-level TypeScript but is required for performance.

> [!WARNING]
> **Pending-State Pattern**: Users must understand that calling `.note()` does not immediately insert a note. It configures a *pending* state. The insertion happens on the *next* relay call or escape. This is a fundamental change from immediate-mode execution.

## Proposed Changes
We will implement the new architecture in `packages/composer/src/new/` to avoid breaking legacy code during the transition.

### Core Cursors
#### [NEW] [SynapticCursor.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer/src/new/cursors/SynapticCursor.ts)
Abstract base class. Handles shared state (`clip`, `bridge`, `baseTick`), core modifiers (`velocity`, `duration`), and clip-level escapes (`rest`, `commit`).

#### [NEW] [SynapticNoteCursor.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer/src/new/cursors/SynapticNoteCursor.ts)
Basic single-note cursor. Extends `SynapticCursor`. Should support `note(pitch)` relay.

#### [NEW] [SynapticMelodyBaseCursor.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer/src/new/cursors/SynapticMelodyBaseCursor.ts)
Base for pitched melodic cursors. Adds expression (`detune`, `glide`, `timbre`).

#### [NEW] [SynapticMelodyNoteCursor.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer/src/new/cursors/SynapticMelodyNoteCursor.ts)
The primary cursor for melody generation. Extends `SynapticMelodyBaseCursor`.
- Relays: `note()`, `chord()`, `degree()`.
- Modifiers: `sharp()`, `flat()`.

#### [NEW] [SynapticChordCursor.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer/src/new/cursors/SynapticChordCursor.ts)
Zero-allocation chord handler. Extends `SynapticMelodyBaseCursor`.
- Uses bitmask iteration for `flush()`.
- Pre-allocated `sourceIds` and `pitches` arrays.

#### [NEW] [SynapticDrumHitCursor.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer/src/new/cursors/SynapticDrumHitCursor.ts)
Percussive event cursor. Extends `SynapticCursor`.

### Clip Builders
#### [NEW] [SynapticClip.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer/src/new/clips/SynapticClip.ts)
Refreshed base for clips, managing the `SiliconBridge` and time tracking.

#### [NEW] [SynapticMelody.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer/src/new/clips/SynapticMelody.ts)
The melody specific builder. Instantiates `SynapticMelodyNoteCursor` and `SynapticChordCursor`.

#### [NEW] [SynapticDrums.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer/src/new/clips/SynapticDrums.ts)
The drum specific builder.

### Groove Engine
#### [NEW] [GrooveBuilder.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer/src/new/groove/GrooveBuilder.ts)
Mutable builder for groove templates.

#### [NEW] [GrooveStepCursor.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer/src/new/groove/GrooveStepCursor.ts)
Cursor for configuring individual groove steps.

## Verification Plan
We will create a new test suite in `packages/composer/src/new/__tests__/` mirroring the legacy tests but adapted for the new architecture.

### Automated Tests
Run with: `npx nx test composer` (targeting the new test files).

#### `SynapticMelody.test.ts`
- Verify chainability and `degree()` / `chord()` relays.
- **Critical**: Verify correct timing calculation after multiple chained notes (Pending state logic).

#### `SynapticChordCursor.test.ts`
- Verify `chord(mask)` parses correctly.
- Verify `flush()` inserts correct number of notes into the mocked bridge.

#### `ZeroAllocation.test.ts` (Manual Inspection / Logic Check)
- Verify `flush()` logic does not use closures.
- Verify Cursor objects are reused (Relays return `this`).

### Manual Verification
Review the code to ensure strict adherence to "No `new` in hot paths".
