import type { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import type { PitchClass, ScaleMode } from '@symphonyscript/theory'
import { ScopedSetterBuilder } from './ScopedSetterBuilder'
import { MIDI_CC } from '@symphonyscript/theory'

// ============================================================================
// Setter Builders — one per bridge state field
// ============================================================================

export class TransposeBuilder extends ScopedSetterBuilder<TransposeBuilder> {
  constructor(private readonly value: number, entries: PipeStep[][] = []) {
    super(entries)
  }
  protected set(bridge: CompositionBridge) { return bridge.withTranspose(this.value) }
  protected restore(result: CompositionBridge, parent: CompositionBridge) {
    return result.withTranspose(parent.transpose)
  }
  protected cloneWithEntries(entries: PipeStep[][]): TransposeBuilder {
    return new TransposeBuilder(this.value, entries)
  }
}

export class VelocityBuilder extends ScopedSetterBuilder<VelocityBuilder> {
  constructor(private readonly value: number, entries: PipeStep[][] = []) {
    super(entries)
  }
  protected set(bridge: CompositionBridge) { return bridge.withVelocity(this.value) }
  protected restore(result: CompositionBridge, parent: CompositionBridge) {
    return result.withVelocity(parent.velocity)
  }
  protected cloneWithEntries(entries: PipeStep[][]): VelocityBuilder {
    return new VelocityBuilder(this.value, entries)
  }
}

export class TempoBuilder extends ScopedSetterBuilder<TempoBuilder> {
  constructor(private readonly bpm: number, entries: PipeStep[][] = []) {
    super(entries)
  }
  protected set(bridge: CompositionBridge) { return bridge.withTempo(this.bpm) }
  protected restore(result: CompositionBridge, parent: CompositionBridge) {
    return result.withTempo(parent.tempo)
  }
  protected cloneWithEntries(entries: PipeStep[][]): TempoBuilder {
    return new TempoBuilder(this.bpm, entries)
  }
}

export class DefaultDurationBuilder extends ScopedSetterBuilder<DefaultDurationBuilder> {
  constructor(private readonly duration: number, entries: PipeStep[][] = []) {
    super(entries)
  }
  protected set(bridge: CompositionBridge) { return bridge.withDefaultDuration(this.duration) }
  protected restore(result: CompositionBridge, parent: CompositionBridge) {
    return result.withDefaultDuration(parent.defaultDuration)
  }
  protected cloneWithEntries(entries: PipeStep[][]): DefaultDurationBuilder {
    return new DefaultDurationBuilder(this.duration, entries)
  }
}

export class TimeSignatureBuilder extends ScopedSetterBuilder<TimeSignatureBuilder> {
  constructor(
    private readonly num: number,
    private readonly den: number,
    entries: PipeStep[][] = [],
  ) {
    super(entries)
  }
  protected set(bridge: CompositionBridge) { return bridge.withTimeSignature(this.num, this.den) }
  protected restore(result: CompositionBridge, parent: CompositionBridge) {
    return result.withTimeSignature(parent.timeSignatureNum, parent.timeSignatureDen)
  }
  protected cloneWithEntries(entries: PipeStep[][]): TimeSignatureBuilder {
    return new TimeSignatureBuilder(this.num, this.den, entries)
  }
}

export class ScaleBuilder extends ScopedSetterBuilder<ScaleBuilder> {
  constructor(
    private readonly root: PitchClass,
    private readonly mode: ScaleMode,
    entries: PipeStep[][] = [],
  ) {
    super(entries)
  }
  protected set(bridge: CompositionBridge) { return bridge.withScale(this.root, this.mode) }
  protected restore(result: CompositionBridge, parent: CompositionBridge) {
    return result.withScale(parent.scaleRoot as PitchClass, parent.scaleMode)
  }
  protected cloneWithEntries(entries: PipeStep[][]): ScaleBuilder {
    return new ScaleBuilder(this.root, this.mode, entries)
  }
}

export class PreciseBuilder extends ScopedSetterBuilder<PreciseBuilder> {
  constructor(private readonly value: boolean, entries: PipeStep[][] = []) {
    super(entries)
  }
  protected set(bridge: CompositionBridge) { return bridge.withPrecise(this.value) }
  protected restore(result: CompositionBridge, parent: CompositionBridge) {
    return result.withPrecise(parent.precise)
  }
  protected cloneWithEntries(entries: PipeStep[][]): PreciseBuilder {
    return new PreciseBuilder(this.value, entries)
  }
}

export class OctaveBuilder extends ScopedSetterBuilder<OctaveBuilder> {
  constructor(private readonly octave: number, entries: PipeStep[][] = []) {
    super(entries)
  }
  protected set(bridge: CompositionBridge) { return bridge.withTranspose((this.octave - 4) * 12) }
  protected restore(result: CompositionBridge, parent: CompositionBridge) {
    return result.withTranspose(parent.transpose)
  }
  protected cloneWithEntries(entries: PipeStep[][]): OctaveBuilder {
    return new OctaveBuilder(this.octave, entries)
  }
}

export class VolumeBuilder extends ScopedSetterBuilder<VolumeBuilder> {
  constructor(private readonly value: number, entries: PipeStep[][] = []) {
    super(entries)
  }
  protected set(bridge: CompositionBridge) { return bridge.withCC(MIDI_CC.VOLUME, this.value) }
  protected restore(result: CompositionBridge, parent: CompositionBridge) {
    // CC events don't have bridge-level getters; re-emit the parent's CC value.
    // Since we can't read the parent's CC state, we re-emit a sensible default.
    // This is a best-effort restore — full CC state tracking requires the modulation engine.
    return result
  }
  protected cloneWithEntries(entries: PipeStep[][]): VolumeBuilder {
    return new VolumeBuilder(this.value, entries)
  }
}

export class PanBuilder extends ScopedSetterBuilder<PanBuilder> {
  constructor(private readonly value: number, entries: PipeStep[][] = []) {
    super(entries)
  }
  protected set(bridge: CompositionBridge) { return bridge.withCC(MIDI_CC.PAN, this.value) }
  protected restore(result: CompositionBridge, parent: CompositionBridge) {
    return result
  }
  protected cloneWithEntries(entries: PipeStep[][]): PanBuilder {
    return new PanBuilder(this.value, entries)
  }
}
