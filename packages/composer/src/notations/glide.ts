import { PipeStep, step } from '@symphonyscript/composer'
import { GlideBridge } from '../composition/GlideBridge'

/**
 * Create a {@link PipeStep} that enables portamento (glide) between consecutive notes.
 *
 * Runs each step through {@link GlideBridge}: before the first note, sends MIDI CC 65
 * (PORTAMENTO) with value 127 so the synthesizer glides from each pitch to the next
 * instead of stepping. On flush (after the last step), sends CC 65 = 0 to disable
 * portamento.
 *
 * Glide time is typically configured separately (e.g. CC 5 or synth-specific control).
 *
 * @param steps - One or more {@link PipeStep}s whose notes will glide into each other
 * @returns A {@link PipeStep} that applies the given steps with portamento active
 *
 * @example
 * ```ts
 * glide(note('C4'), note('E4'), note('G4'))   // C4 → E4 → G4 with portamento
 * glide(note('C4'), chord('Am'))              // Melody into chord with glide
 * clip.pipe(glide(note('C4'), note('G4')))    // Glide phrase in a pipe
 * ```
 */
export function glide(...steps: PipeStep[]): PipeStep {
  return step((bridge) => {
    let current = new GlideBridge(bridge)

    for (let i = 0; i < steps.length; ++i) {
      current = new GlideBridge(steps[i].apply(current))
    }

    return current.flush()
  })
}
