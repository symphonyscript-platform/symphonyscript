/**
 * @symphonyscript/theory
 *
 * Universal music theory standard library.
 * Constants, types, and pure math functions — notation-free.
 */

// --- Grouped Constants ---
export { Note } from '../../theory/src/note'
export { Drum } from '../../theory/src/drum'
export { Interval } from '../../theory/src/interval'
export { Scale } from '../../theory/src/scale'
export { Chord } from '../../theory/src/chord'
export { Degree } from '../../theory/src/degree'
export { Duration } from '../../theory/src/duration'
export { Articulation } from '../../theory/src/articulation'
export { Temperament } from '../../theory/src/temperament'
export { Groove } from '../../theory/src/groove'

// --- Functions ---
export { ratioToCents, invertInterval, isEnharmonic, getIntervalQuality } from '../../theory/src/interval'
export { degreeToCents } from '../../theory/src/scale'
export { beatsToSeconds, secondsToBeats } from '../../theory/src/duration'
export { resolveTemperament } from '../../theory/src/temperament'
export { euclidean, rotatePattern, patternToString } from '../../theory/src/rhythm'
export { createSwing, getGrooveTiming, getGrooveVelocity, getGrooveDuration } from '../../theory/src/groove'
export {
  getNextBeat, getNextBarBeat, getCurrentBar, getBeatInBar,
  getQuantizeTargetBeat, getBeatDuration, getBarDuration,
  isWithinLookahead, getEffectiveCancelBeat,
  getCurrentBeatFromAudioTime, getAudioTimeForBeat,
  isAtQuantizeBoundary, getTimeUntilNextQuantize,
  getQuantizeTargetWithLookahead, getBeatGridInfo,
  beatsToSeconds as quantizeBeatsToSeconds,
  secondsToBeats as quantizeSecondsToBeats,
} from '../../theory/src/quantize'
export {
  voiceMovementCost, closeVoicing, openVoicing, drop2Voicing,
  voiceLead, voiceLeadProgression,
  pitchToInterval, pitchToOctave, createPitch,
} from '../../theory/src/voiceleading'

// --- Types ---
export type { IntervalQuality } from '../../theory/src/interval'
export type { ChordIntervals } from '../../theory/src/chord'
export type { Temperament as TemperamentType, TemperamentName } from '../../theory/src/temperament'
export type { ArpPattern } from '../../theory/src/rhythm'
export type { GrooveStep, GrooveTemplate } from '../../theory/src/groove'
export type { QuantizeMode, TimeSignature } from '../../theory/src/quantize'
export type { VoiceLeadingStyle, VoiceLeadOptions, VoiceMovement } from '../../theory/src/voiceleading'

// --- Legacy (deprecated, will be removed) ---
export * from './pitch'
export * from './rhythm'
export * from './harmony'
export * from './util'
export * from './effects'
export * from './continuous'
