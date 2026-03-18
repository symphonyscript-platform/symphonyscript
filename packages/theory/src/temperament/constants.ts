/**
 * Temperament presets — tuning systems as arrays of 12 cent intervals.
 */

import type { Temperament } from './types'

/** 12-tone equal temperament. Each semitone = 100 cents. */
export const Equal: Temperament = [
  0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100,
]

/**
 * 5-limit just intonation.
 * Intervals from pure harmonic ratios (2, 3, 5).
 */
export const Just: Temperament = [
  0,     // C   = 1/1
  112,   // C#  = 16/15
  204,   // D   = 9/8
  316,   // Eb  = 6/5
  386,   // E   = 5/4
  498,   // F   = 4/3
  590,   // F#  = 45/32
  702,   // G   = 3/2
  814,   // Ab  = 8/5
  884,   // A   = 5/3
  1018,  // Bb  = 9/5
  1088,  // B   = 15/8
]

/**
 * Pythagorean tuning.
 * All intervals from pure fifths (3/2 ratio).
 */
export const Pythagorean: Temperament = [
  0,     // C   = 1/1
  90,    // Db  = 256/243
  204,   // D   = 9/8
  294,   // Eb  = 32/27
  408,   // E   = 81/64
  498,   // F   = 4/3
  612,   // F#  = 729/512
  702,   // G   = 3/2
  792,   // Ab  = 128/81
  906,   // A   = 27/16
  996,   // Bb  = 16/9
  1110,  // B   = 243/128
]

/**
 * Quarter-comma meantone.
 * Tempers fifths so major thirds are pure (5/4 = 386 cents).
 */
export const Meantone: Temperament = [
  0,     // C
  76,    // C#
  193,   // D
  310,   // Eb
  386,   // E  (pure 5/4)
  503,   // F
  580,   // F#
  697,   // G
  814,   // Ab
  890,   // A
  1007,  // Bb
  1083,  // B
]
