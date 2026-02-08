# Task 057: Flatten SynapticClip State

## Goal
Replace all object-based state in `SynapticClip` with primitive fields (numbers/enums) to ensure zero-allocation during property updates and reads.

## Proposed APIs / Data Structures
- Replace `activeDynamics: DynamicsOp | null` with:
    - `protected _dynType: number = 0;` (0=None, 1=Crescendo, etc.)
    - `protected _dynFrom: number = 0;`
    - `protected _dynTo: number = 0;`
    - `protected _dynStart: number = 0;`
    - `protected _dynDur: number = 0;`
    - `protected _dynCurve: number = 0;`
- Replace `scaleContext` with `_scaleRoot`, `_scaleMode`, `_scaleOctave`.
- Replace `keyContext` with `_keyRoot`, `_keyMode`.
- Replace `_humanizeSettings` with primitive fields.
- Replace `_quantizeSettings` with primitive fields.

## Implementation Steps
1. Modify `SynapticClip.ts`: Declare primitive fields.
2. Update accessor methods (`crescendo`, `scale`, etc.) to write to primitives.
3. Update `flushNote` to read from primitives.
4. Remove the old object fields.

## Acceptance Criteria
- [ ] No `activeDynamics` object is created when calling `crescendo()`.
- [ ] No `scaleContext` object is created when calling `scale()`.
- [ ] `flushNote` logic correctly reads from the new primitive fields.
