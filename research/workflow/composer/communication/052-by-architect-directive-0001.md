# Directive: Task 052

## Task
Implement vibrato via pitch bend LFO emission.

## Requirements

1. **Add `PitchBendOperation` type** to `types.ts`:
   ```typescript
   export interface PitchBendOperation {
       kind: 'pitchBend';
       value: number;  // -8192 to 8191
       tick: number;
   }
   ```

2. **Update operations array type** in `SynapticClip.ts` to include `PitchBendOperation`

3. **Implement `emitVibratoLFO(tick, duration)` method** in `SynapticClip.ts`:
   - If `vibratoRate <= 0` or `vibratoDepth <= 0`, return immediately
   - Sample interval: ~48 ticks (suitable for smooth LFO)
   - Emit pitch bend events following sine wave
   - Reset pitch bend to 0 at note end

4. **Integrate in `flushNote()`**:
   ```typescript
   if (this.vibratoRate > 0 && this.vibratoDepth > 0) {
       this.emitVibratoLFO(tick, duration);
   }
   ```

5. **Add `vibratoOff()` method**:
   ```typescript
   vibratoOff(): this {
       this.vibratoRate = 0;
       this.vibratoDepth = 0;
       return this;
   }
   ```

## Files

- `[MODIFY] packages/composer/src/types.ts`
- `[MODIFY] packages/composer/src/clips/SynapticClip.ts`
- `[NEW] packages/composer/src/__tests__/Vibrato.test.ts`

## Acceptance Criteria

- [ ] `PitchBendOperation` type added
- [ ] `vibrato(5, 0.5)` causes subsequent notes to emit pitch bend events
- [ ] Pitch bend values oscillate (sine wave, positive and negative)
- [ ] Pitch bend resets to 0 at note end
- [ ] `vibratoOff()` disables vibrato for subsequent notes
- [ ] Rate controls LFO frequency
- [ ] Depth controls pitch bend amplitude (semitones)
- [ ] Build succeeds (pre-existing errors excluded)
- [ ] `Vibrato.test.ts` passes
