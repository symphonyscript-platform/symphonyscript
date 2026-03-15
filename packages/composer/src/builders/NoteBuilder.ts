import { CompositionBridge, PipeStep } from '@symphonyscript/composer'

export interface NoteParams {
  pitch: number
  duration: number | null
  durationScale: number
  velocity: number | null
  octaveShift: number
  accidental: number
  precise: boolean
  muted: boolean
  detune: number | null
  timbre: number | null
  pressure: number | null
  glide: boolean
}

export class NoteBuilder implements PipeStep {
  private readonly params: NoteParams

  constructor(params: Partial<NoteParams>) {
    this.params = {
      pitch: params.pitch ?? 60,
      duration: params.duration ?? null,
      durationScale: params.durationScale ?? 1.0,
      velocity: params.velocity ?? null,
      octaveShift: params.octaveShift ?? 0,
      accidental: params.accidental ?? 0,
      precise: params.precise ?? false,
      muted: params.muted ?? false,
      detune: params.detune ?? null,
      timbre: params.timbre ?? null,
      pressure: params.pressure ?? null,
      glide: params.glide ?? false,
    }
  }

  // === Core Modifiers ===

  velocity(velocity: number): NoteBuilder {
    return new NoteBuilder({ ...this.params, velocity })
  }

  duration(duration: number): NoteBuilder {
    return new NoteBuilder({ ...this.params, duration })
  }

  sharp(): NoteBuilder {
    return new NoteBuilder({ ...this.params, accidental: this.params.accidental + 1 })
  }

  flat(): NoteBuilder {
    return new NoteBuilder({ ...this.params, accidental: this.params.accidental - 1 })
  }

  natural(): NoteBuilder {
    return new NoteBuilder({ ...this.params, accidental: 0 })
  }

  octave(shift: number): NoteBuilder {
    return new NoteBuilder({ ...this.params, octaveShift: shift })
  }

  up(octaves: number = 1): NoteBuilder {
    return new NoteBuilder({ ...this.params, octaveShift: this.params.octaveShift + octaves })
  }

  down(octaves: number = 1): NoteBuilder {
    return new NoteBuilder({ ...this.params, octaveShift: this.params.octaveShift - octaves })
  }

  precise(): NoteBuilder {
    return new NoteBuilder({ ...this.params, precise: true })
  }

  muted(): NoteBuilder {
    return new NoteBuilder({ ...this.params, muted: true })
  }

  // === Articulations ===

  accent(): NoteBuilder {
    return new NoteBuilder({ ...this.params, velocity: 1200, precise: true })
  }

  staccato(): NoteBuilder {
    return new NoteBuilder({ ...this.params, durationScale: 0.5 })
  }

  legato(): NoteBuilder {
    return new NoteBuilder({ ...this.params, durationScale: 1.0 })
  }

  tenuto(): NoteBuilder {
    return new NoteBuilder({ ...this.params, durationScale: 0.95 })
  }

  marcato(): NoteBuilder {
    return new NoteBuilder({
      ...this.params,
      durationScale: 0.7,
      velocity: (this.params.velocity ?? 800) + 200,
      precise: true,
    })
  }

  // === Expression ===

  detune(detune: number): NoteBuilder {
    return new NoteBuilder({ ...this.params, detune })
  }

  timbre(timbre: number): NoteBuilder {
    return new NoteBuilder({ ...this.params, timbre })
  }

  pressure(pressure: number): NoteBuilder {
    return new NoteBuilder({ ...this.params, pressure })
  }

  glide(enable: boolean = true): NoteBuilder {
    return new NoteBuilder({ ...this.params, glide: enable })
  }

  // === Apply ===

  apply(bridge: CompositionBridge): CompositionBridge {
    const finalPitch = this.params.pitch
      + this.params.accidental
      + (this.params.octaveShift * 12)

    let target = bridge

    if (this.params.precise) {
      target = target.withPrecise(true)
    }

    if (this.params.muted) {
      target = target.withMuted(true)
    }

    // Expression events (emitted at current tick before the note)
    if (this.params.detune !== null) {
      target = target.withBend(this.params.detune)
    }

    if (this.params.timbre !== null) {
      target = target.withCC(74, this.params.timbre)
    }

    if (this.params.pressure !== null) {
      target = target.withCC(13, this.params.pressure)
    }

    if (this.params.glide) {
      target = target.withCC(65, 127)
    }

    // Resolve duration
    const baseDuration = this.params.duration ?? undefined
    const scaledDuration = baseDuration !== undefined
      ? Math.round(baseDuration * this.params.durationScale)
      : undefined

    target = target.withNote(
      finalPitch,
      scaledDuration,
      this.params.velocity ?? undefined,
    )

    // Turn off glide after note
    if (this.params.glide) {
      target = target.withCC(65, 0)
    }

    // Reset scoped flags
    if (this.params.precise) {
      target = target.withPrecise(false)
    }

    if (this.params.muted) {
      target = target.withMuted(false)
    }

    return target
  }
}

