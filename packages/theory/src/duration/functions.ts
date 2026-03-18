/**
 * Pure time conversion functions.
 */

/**
 * Convert beats to seconds at a given BPM.
 *
 * @param beats - Number of beats
 * @param bpm - Tempo in beats per minute
 * @returns Duration in seconds
 */
export function beatsToSeconds(beats: number, bpm: number): number {
  return beats * (60 / bpm)
}

/**
 * Convert seconds to beats at a given BPM.
 *
 * @param seconds - Duration in seconds
 * @param bpm - Tempo in beats per minute
 * @returns Number of beats
 */
export function secondsToBeats(seconds: number, bpm: number): number {
  return seconds * (bpm / 60)
}
