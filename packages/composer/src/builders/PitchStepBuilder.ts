import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { MIDI_CC } from '@symphonyscript/theory'
import type { AccidentalOverride } from '@symphonyscript/theory'

export interface PitchStepParams {
  duration: number | null
  durationScale: number
  velocity: number | null
  octaveShift: number
  accidental: number
  accidentalOverride: AccidentalOverride | null
  precise: boolean
  muted: boolean
  detune: number | null
  timbre: number | null
  pressure: number | null
  repeatCount: number
  transposeSemitones: number
  aftertouch: number | null
}

export const DEFAULT_PITCH_STEP_PARAMS: PitchStepParams = {
  duration: null,
  durationScale: 1.0,
  velocity: null,
  octaveShift: 0,
  accidental: 0,
  accidentalOverride: null,
  precise: false,
  muted: false,
  detune: null,
  timbre: null,
  pressure: null,
  repeatCount: 1,
  transposeSemitones: 0,
  aftertouch: null,
}

export abstract class PitchStepBuilder<T extends PitchStepBuilder<T>> implements PipeStep {
  protected readonly shared: PitchStepParams

  protected constructor(shared: Partial<PitchStepParams>) {
    this.shared = {
      ...DEFAULT_PITCH_STEP_PARAMS,
      ...shared,
    }
  }

  velocity(velocity: number): T {
    return this.create({ ...this.shared, velocity })
  }

  // === Core Modifiers ===

  duration(duration: number): T {
    return this.create({ ...this.shared, duration })
  }

  sharp(): T {
    return this.create({ ...this.shared, accidental: this.shared.accidental + 1, accidentalOverride: 'sharp' })
  }

  flat(): T {
    return this.create({ ...this.shared, accidental: this.shared.accidental - 1, accidentalOverride: 'flat' })
  }

  natural(): T {
    return this.create({ ...this.shared, accidental: 0, accidentalOverride: 'natural' })
  }

  octave(shift: number): T {
    return this.create({ ...this.shared, octaveShift: shift })
  }

  up(octaves: number = 1): T {
    return this.create({ ...this.shared, octaveShift: this.shared.octaveShift + octaves })
  }

  down(octaves: number = 1): T {
    return this.create({ ...this.shared, octaveShift: this.shared.octaveShift - octaves })
  }

  precise(): T {
    return this.create({ ...this.shared, precise: true })
  }

  muted(): T {
    return this.create({ ...this.shared, muted: true })
  }

  repeat(count: number): T {
    return this.create({ ...this.shared, repeatCount: count })
  }

  transpose(semitones: number): T {
    return this.create({ ...this.shared, transposeSemitones: semitones })
  }

  accent(): T {
    return this.create({ ...this.shared, velocity: 1200, precise: true })
  }

  // === Articulations ===

  staccato(): T {
    return this.create({ ...this.shared, durationScale: 0.5 })
  }

  legato(): T {
    return this.create({ ...this.shared, durationScale: 1.0 })
  }

  tenuto(): T {
    return this.create({ ...this.shared, durationScale: 0.95 })
  }

  marcato(): T {
    return this.create({
      ...this.shared,
      durationScale: 0.7,
      velocity: (this.shared.velocity ?? 800) + 200,
      precise: true,
    })
  }

  detune(detune: number): T {
    return this.create({ ...this.shared, detune })
  }

  // === Expression ===

  timbre(timbre: number): T {
    return this.create({ ...this.shared, timbre })
  }

  pressure(pressure: number): T {
    return this.create({ ...this.shared, pressure })
  }

  aftertouch(aftertouch: number): T {
    return this.create({ ...this.shared, aftertouch })
  }

  abstract apply(bridge: CompositionBridge): CompositionBridge

  // === Apply Helpers ===

  protected abstract create(params: Partial<PitchStepParams>): T

  protected applyFlags(bridge: CompositionBridge): CompositionBridge {
    let target = bridge

    if (this.shared.precise) {
      target = target.withPrecise(true)
    }

    if (this.shared.muted) {
      target = target.withMuted(true)
    }

    if (this.shared.detune !== null) {
      target = target.withBend(this.shared.detune)
    }

    if (this.shared.timbre !== null) {
      target = target.withCC(MIDI_CC.BRIGHTNESS, this.shared.timbre)
    }

    if (this.shared.pressure !== null) {
      target = target.withCC(MIDI_CC.EFFECT_2, this.shared.pressure)
    }

    if (this.shared.aftertouch !== null) {
      target = target.withAftertouch(this.shared.aftertouch)
    }

    return target
  }

  protected resetFlags(bridge: CompositionBridge): CompositionBridge {
    let target = bridge

    if (this.shared.precise) {
      target = target.withPrecise(false)
    }

    if (this.shared.muted) {
      target = target.withMuted(false)
    }

    return target
  }

  protected resolvedDuration(): number | undefined {
    const baseDuration = this.shared.duration ?? undefined
    if (baseDuration === undefined) return undefined

    return Math.round(baseDuration * this.shared.durationScale)
  }
}
