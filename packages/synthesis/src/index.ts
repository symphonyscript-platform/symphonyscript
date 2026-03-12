/**
 * @packageDocumentation
 * @module @symphonyscript/synthesis
 *
 * This package provides high-level synthesis factories built on top of
 * `@symphonyscript/dsp` runtime primitives.
 *
 * Available:
 * - Subtractive synth convenience factory (`createSubtractiveInstrument`)
 *
 * Planned:
 * - FM synthesizer factory (`createFMSynth`)
 */

export type { FMSynthOptions, SubtractiveSynthOptions } from './factory-types';
export { createFMSynth } from './fm';
export { createSubtractiveInstrument } from './subtractive';
