/**
 * RFC-047: Rhythm Module (24-EDO Native)
 *
 * Euclidean rhythms, beat-grid quantization, groove templates,
 * articulation, and duration utilities.
 */
export { euclidean, euclideanMask, euclideanForEach, rotatePattern, rotateMask, patternToString, } from './euclidean';
export { type QuantizeMode, type TimeSignature, parseTimeSignature as parseQuantizeTimeSignature, getNextBeat, getNextBarBeat, getCurrentBar, getBeatInBar, getQuantizeTargetBeat, beatsToSeconds as quantizeBeatsToSeconds, secondsToBeats as quantizeSecondsToBeats, getBeatDuration, getBarDuration, isWithinLookahead, getEffectiveCancelBeat, getCurrentBeatFromAudioTime, getAudioTimeForBeat, isAtQuantizeBoundary, getTimeUntilNextQuantize, getQuantizeTargetWithLookahead, getBeatGridInfo, } from './quantize';
export { type GrooveStep, type GrooveTemplate, createSwing, GROOVE, applyGroove, getGrooveTiming, getGrooveVelocity, getGrooveDuration, } from './grooves';
export { type Articulation, ARTICULATION_MULTIPLIER, ARTICULATION_VELOCITY, getArticulationMultiplier, getArticulationVelocity, isArticulation, } from './articulation';
export { type StandardDuration, type DottedDuration, type TripletDuration, type NoteDuration, type ParsedTimeSignature, DURATION, beatsToSeconds, secondsToBeats, parseTimeSignature, parseDuration, getDurationBeats, durationToMs, isValidDuration, } from './duration';
export * from './types';
export * from './tempo';
//# sourceMappingURL=index.d.ts.map