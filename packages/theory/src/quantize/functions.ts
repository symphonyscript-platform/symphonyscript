/**
 * Beat-grid quantization utilities.
 * All functions are pure arithmetic.
 */

import type { QuantizeMode } from './types'
import { beatsToSeconds, secondsToBeats } from '../duration/functions'

/**
 * Get the next beat boundary from the current position.
 *
 * @param currentBeat - Current beat position (can be fractional)
 * @returns Next whole beat number
 */
export function getNextBeat(currentBeat: number): number {
  return Math.ceil(currentBeat)
}

/**
 * Get the next bar boundary from the current position.
 *
 * @param currentBeat - Current beat position
 * @param beatsPerMeasure - Beats per measure
 * @returns Beat number at the start of the next bar
 */
export function getNextBarBeat(currentBeat: number, beatsPerMeasure: number): number {
  const currentBar = Math.floor(currentBeat / beatsPerMeasure)
  return (currentBar + 1) * beatsPerMeasure
}

/**
 * Get the current bar number (0-indexed).
 *
 * @param currentBeat - Current beat position
 * @param beatsPerMeasure - Beats per measure
 * @returns Current bar number
 */
export function getCurrentBar(currentBeat: number, beatsPerMeasure: number): number {
  return Math.floor(currentBeat / beatsPerMeasure)
}

/**
 * Get the beat position within the current bar (0-indexed).
 *
 * @param currentBeat - Current beat position
 * @param beatsPerMeasure - Beats per measure
 * @returns Beat within current bar
 */
export function getBeatInBar(currentBeat: number, beatsPerMeasure: number): number {
  return currentBeat % beatsPerMeasure
}

/**
 * Calculate the target beat for a quantized update.
 *
 * @param currentBeat - Current beat position
 * @param mode - Quantize mode
 * @param beatsPerMeasure - Beats per measure
 * @returns Target beat for the update
 */
export function getQuantizeTargetBeat(
  currentBeat: number,
  mode: QuantizeMode,
  beatsPerMeasure: number,
): number {
  switch (mode) {
    case 'bar':
      return getNextBarBeat(currentBeat, beatsPerMeasure)
    case 'beat':
      return getNextBeat(currentBeat)
    case 'off':
      return currentBeat
  }
}



/**
 * Get the duration of one beat in seconds.
 *
 * @param bpm - Tempo in BPM
 * @returns Beat duration in seconds
 */
export function getBeatDuration(bpm: number): number {
  return 60 / bpm
}

/**
 * Get the duration of one bar in seconds.
 *
 * @param bpm - Tempo in BPM
 * @param beatsPerMeasure - Beats per measure
 * @returns Bar duration in seconds
 */
export function getBarDuration(bpm: number, beatsPerMeasure: number): number {
  return beatsToSeconds(beatsPerMeasure, bpm)
}

/**
 * Check if a beat position is within the lookahead window.
 *
 * @param beat - Beat position to check
 * @param currentBeat - Current playback beat
 * @param lookaheadBeats - Lookahead window in beats
 * @returns True if within lookahead
 */
export function isWithinLookahead(
  beat: number,
  currentBeat: number,
  lookaheadBeats: number,
): boolean {
  return beat >= currentBeat && beat < currentBeat + lookaheadBeats
}

/**
 * Get the effective start beat for cancellation, respecting lookahead.
 *
 * @param requestedBeat - Beat at which user requested changes
 * @param currentBeat - Current playback beat
 * @param lookaheadBeats - Lookahead window in beats
 * @returns Effective beat from which to cancel
 */
export function getEffectiveCancelBeat(
  requestedBeat: number,
  currentBeat: number,
  lookaheadBeats: number,
): number {
  const lookaheadEnd = currentBeat + lookaheadBeats
  return Math.max(requestedBeat, lookaheadEnd)
}

/**
 * Calculate current beat position from audio context state.
 *
 * @param audioTime - Current audio context time
 * @param playbackStartTime - Audio time when playback started
 * @param playbackStartBeat - Beat position when playback started
 * @param bpm - Current tempo
 * @returns Current beat position
 */
export function getCurrentBeatFromAudioTime(
  audioTime: number,
  playbackStartTime: number,
  playbackStartBeat: number,
  bpm: number,
): number {
  const elapsedSeconds = audioTime - playbackStartTime
  const elapsedBeats = secondsToBeats(elapsedSeconds, bpm)
  return playbackStartBeat + elapsedBeats
}

/**
 * Calculate the audio time for a target beat.
 *
 * @param targetBeat - Target beat position
 * @param playbackStartTime - Audio time when playback started
 * @param playbackStartBeat - Beat position when playback started
 * @param bpm - Current tempo
 * @returns Audio time at target beat
 */
export function getAudioTimeForBeat(
  targetBeat: number,
  playbackStartTime: number,
  playbackStartBeat: number,
  bpm: number,
): number {
  const beatDelta = targetBeat - playbackStartBeat
  const secondsDelta = beatsToSeconds(beatDelta, bpm)
  return playbackStartTime + secondsDelta
}

/**
 * Check if a beat position is exactly on a quantize boundary.
 *
 * @param beat - Beat position to check
 * @param mode - Quantize mode
 * @param beatsPerMeasure - Beats per measure
 * @param tolerance - Float tolerance (default 0.001)
 * @returns True if on boundary
 */
export function isAtQuantizeBoundary(
  beat: number,
  mode: QuantizeMode,
  beatsPerMeasure: number,
  tolerance: number = 0.001,
): boolean {
  switch (mode) {
    case 'bar':
      return Math.abs(beat % beatsPerMeasure) < tolerance ||
        Math.abs(beat % beatsPerMeasure - beatsPerMeasure) < tolerance
    case 'beat':
      return Math.abs(beat - Math.round(beat)) < tolerance
    case 'off':
      return true
  }
}

/**
 * Get time (seconds) until the next quantize boundary.
 *
 * @param currentBeat - Current beat position
 * @param mode - Quantize mode
 * @param beatsPerMeasure - Beats per measure
 * @param bpm - Tempo in BPM
 * @returns Time in seconds until next boundary (0 if off)
 */
export function getTimeUntilNextQuantize(
  currentBeat: number,
  mode: QuantizeMode,
  beatsPerMeasure: number,
  bpm: number,
): number {
  if (mode === 'off') return 0
  const targetBeat = getQuantizeTargetBeat(currentBeat, mode, beatsPerMeasure)
  const beatsUntil = targetBeat - currentBeat
  return beatsToSeconds(beatsUntil, bpm)
}

/**
 * Calculate the effective quantize boundary considering lookahead.
 *
 * @param currentBeat - Current beat position
 * @param mode - Quantize mode
 * @param beatsPerMeasure - Beats per measure
 * @param lookaheadBeats - Lookahead window in beats
 * @returns Target beat after lookahead
 */
export function getQuantizeTargetWithLookahead(
  currentBeat: number,
  mode: QuantizeMode,
  beatsPerMeasure: number,
  lookaheadBeats: number,
): number {
  if (mode === 'off') {
    return currentBeat + lookaheadBeats
  }

  let targetBeat = getQuantizeTargetBeat(currentBeat, mode, beatsPerMeasure)
  const step = mode === 'bar' ? beatsPerMeasure : 1

  while (targetBeat < currentBeat + lookaheadBeats) {
    targetBeat += step
  }

  return targetBeat
}

/**
 * Get beat grid information for the current position.
 *
 * @param currentBeat - Current beat position
 * @param beatsPerMeasure - Beats per measure
 * @returns Beat grid info object
 */
export function getBeatGridInfo(
  currentBeat: number,
  beatsPerMeasure: number,
): {
  bar: number
  beatInBar: number
  fractionalBeat: number
  isOnBeat: boolean
  isOnBar: boolean
  beatsUntilNextBar: number
} {
  const bar = getCurrentBar(currentBeat, beatsPerMeasure)
  const beatInBar = getBeatInBar(currentBeat, beatsPerMeasure)
  const wholeBeat = Math.floor(currentBeat)
  const fractionalBeat = currentBeat - wholeBeat

  const tolerance = 0.001
  const isOnBeat = Math.abs(fractionalBeat) < tolerance
  const isOnBar = Math.abs(beatInBar) < tolerance ||
    Math.abs(beatInBar - beatsPerMeasure) < tolerance

  const nextBarBeat = getNextBarBeat(currentBeat, beatsPerMeasure)
  const beatsUntilNextBar = nextBarBeat - currentBeat

  return {
    bar,
    beatInBar: Math.floor(beatInBar),
    fractionalBeat,
    isOnBeat,
    isOnBar,
    beatsUntilNextBar,
  }
}
