# RFC-050-post: Modulation & Automation Extensions

> Deferred items requiring a continuous modulation engine.
> These cannot be implemented with the current per-step/per-note model.

## Deferred Items

### 1. `automate(target, value, rampBeats?, curve?)`
General-purpose CC automation over time with keyframes and easing curves.
Requires a modulation engine that emits interpolated CC values between ticks.

### 2. `vibrato(depth, rate)`
Per-note pitch bend oscillation.
Needs continuous pitch bend modulation at sub-tick resolution.
Could be per-note (modifier on PitchStepBuilder) or standalone (decorator).

### 3. `volume(value, rampBeats)` (with ramp)
CC7 with interpolated ramp over beats.
Without `rampBeats`, this is a simple CC setter (implemented now).
With `rampBeats`, requires the automation engine.

### 4. `pan(value, rampBeats)` (with ramp)
CC10 with interpolated ramp over beats.
Same split as volume.

### 5. `tempoEnvelope(keyframes: TempoKeyframe[])`
Tempo changes over time with curves.
```typescript
interface TempoKeyframe {
  beat: number      // offset from start
  bpm: number
  curve: TempoCurve // linear, exponential, etc.
}
```
Requires a tempo automation system that adjusts tick→time mapping.

### 6. `velocityCurve` (advanced form)
If velocity curves need per-tick interpolation (not just per-note),
this belongs here rather than in the per-note modifier form.

## Prerequisites
- Modulation engine with sub-tick CC interpolation
- Tempo automation system
- Automation target abstraction (`AutomationTarget`)

## Related
- RFC-050 composition API (current)
- DynamicsBridge (existing per-note velocity scaling)
