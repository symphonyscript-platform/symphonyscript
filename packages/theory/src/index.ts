/**
 * @symphonyscript/theory
 *
 * Universal music theory standard library.
 * Constants, types, and pure math functions — notation-free.
 */

// --- Grouped Constants ---
export { Note } from './note'
export { Drum } from './drum'
export { Interval } from './interval'
export { Scale } from './scale'
export { Chord } from './chord'
export { Degree } from './degree'
export { Duration } from './duration'
export { Articulation } from './articulation'
export { Temperament } from './temperament'
export { Groove } from './groove'

// --- Functions ---
export { ratioToCents, invertInterval, isEnharmonic, getIntervalQuality } from './interval'
export { degreeToCents } from './scale'
export { beatsToSeconds, secondsToBeats } from './duration'
export { resolveTemperament } from './temperament'
export { euclidean, rotatePattern, patternToString } from './rhythm'
export { createSwing, getGrooveTiming, getGrooveVelocity, getGrooveDuration } from './groove'
export {
  getNextBeat, getNextBarBeat, getCurrentBar, getBeatInBar,
  getQuantizeTargetBeat, getBeatDuration, getBarDuration,
  isWithinLookahead, getEffectiveCancelBeat,
  getCurrentBeatFromAudioTime, getAudioTimeForBeat,
  isAtQuantizeBoundary, getTimeUntilNextQuantize,
  getQuantizeTargetWithLookahead, getBeatGridInfo,
  beatsToSeconds as quantizeBeatsToSeconds,
  secondsToBeats as quantizeSecondsToBeats,
} from './quantize'
export {
  voiceMovementCost, closeVoicing, openVoicing, drop2Voicing,
  voiceLead, voiceLeadProgression,
  pitchToInterval, pitchToOctave, createPitch,
} from './voiceleading'

// --- Types ---
export type { IntervalQuality } from './interval'
export type { ChordIntervals } from './chord'
export type { Temperament as TemperamentType, TemperamentName } from './temperament'
export type { ArpPattern } from './rhythm'
export type { GrooveStep, GrooveTemplate } from './groove'
export type { QuantizeMode, TimeSignature } from './quantize'
export type { VoiceLeadingStyle, VoiceLeadOptions, VoiceMovement } from './voiceleading'

// --- Legacy (deprecated, will be removed) ---
export * from './legacy/pitch'
export * from './legacy/rhythm'
export * from './legacy/harmony'
export * from './legacy/util'
export * from './legacy/effects'
export * from './legacy/continuous'
