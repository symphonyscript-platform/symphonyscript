# Directive: Task 024

## Task
Implement dynamics methods for gradual volume changes in SynapticClip.

## Requirements

1. **Add types** to `packages/composer/src/types.ts`:
   ```typescript
   export interface DynamicsOp {
       kind: 'dynamics';
       type: 'crescendo' | 'decrescendo' | 'ramp' | 'curve';
       from: number;       // Starting velocity (0-1)
       to: number;         // Ending velocity (0-1)
       duration: number;   // Duration in ticks
       curve?: 'linear' | 'exponential' | 'ease-in' | 'ease-out';
   }
   
   export interface VelocityPoint {
       tick: number;       // Relative tick offset
       velocity: number;   // Velocity (0-1)
   }
   ```

2. **Add dynamics state** to `SynapticClip`:
   - `protected activeDynamics: DynamicsOp | null = null`
   - `protected velocityCurvePoints: VelocityPoint[] | null = null`

3. **Implement methods** in `SynapticClip`:
   ```typescript
   crescendo(duration: number, options?: { from?: number; to?: number; curve?: string }): this
   decrescendo(duration: number, options?: { from?: number; to?: number; curve?: string }): this
   velocityRamp(to: number, duration: number, options?: { from?: number }): this
   velocityCurve(points: VelocityPoint[], duration: number): this
   ```

4. **Apply dynamics** in `flushNote()`:
   - Calculate velocity based on current tick within dynamics range
   - Use linear interpolation (or curve) between from/to
   - For velocityCurve, interpolate between points

5. **Create tests** in `packages/composer/src/__tests__/dynamics.test.ts`

## Files
- `packages/composer/src/types.ts` (add DynamicsOp, VelocityPoint)
- `packages/composer/src/clips/SynapticClip.ts` (add state + methods + apply in flushNote)
- `packages/composer/src/__tests__/dynamics.test.ts` (create)

## Acceptance
- [ ] `crescendo(4)` increases velocity over 4 ticks
- [ ] `decrescendo(4, { from: 1, to: 0.2 })` decreases to 0.2
- [ ] `velocityRamp(0.8, 2)` ramps to 0.8 over 2 ticks
- [ ] `velocityCurve([...], 4)` interpolates custom curve
- [ ] Dynamics apply to notes within the range
- [ ] Dynamics auto-clear after duration expires
- [ ] Tests pass
- [ ] No TODO/FIXME comments
- [ ] No console.log statements
