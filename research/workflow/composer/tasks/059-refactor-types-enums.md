# Task 059: Refactor Types to Enums

## Goal
Replace string literal types with numeric Enums in `packages/composer/src/types.ts` to support the primitive state flattening.

## Proposed APIs / Data Structures
```typescript
export const DYNAMICS = {
    NONE: 0,
    CRESCENDO: 1,
    DECRESCENDO: 2,
    RAMP: 3,
    CURVE: 4
} as const;

export const CURVE = {
    LINEAR: 0,
    EXPONENTIAL: 1,
    EASE_IN: 2,
    EASE_OUT: 3
} as const;

// ... other enums as needed
```

## Implementation Steps
1. Add numeric constant enumerations to `types.ts`.
2. Update `SynapticClip.ts` to use these constants instead of strings.

## Acceptance Criteria
- [ ] `types.ts` exports numeric constants for Dynamics, Curves, Modes.
- [ ] `SynapticClip.ts` uses these constants internally.
