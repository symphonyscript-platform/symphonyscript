/**
 * Standard interval abbreviation ↔ cents lookup maps.
 * Uses constants from interval/constants.ts.
 */

import * as I from './constants'

/** Interval abbreviation → cents. */
export const IntervalNameToCents: Readonly<Record<string, number>> = {
  'P1': I.Unison,
  'm2': I.Semitone,
  'M2': I.WholeTone,
  'm3': I.MinorThird,
  'M3': I.MajorThird,
  'P4': I.PerfectFourth,
  'tritone': I.Tritone, 'A4': I.Tritone, 'd5': I.Tritone,
  'P5': I.PerfectFifth,
  'm6': I.MinorSixth,
  'M6': I.MajorSixth,
  'm7': I.MinorSeventh,
  'M7': I.MajorSeventh,
  'P8': I.Octave,
}

/** Cents → canonical interval abbreviation. */
export const CentsToIntervalName: Readonly<Record<number, string>> = {
  [I.Unison]: 'P1',
  [I.Semitone]: 'm2',
  [I.WholeTone]: 'M2',
  [I.MinorThird]: 'm3',
  [I.MajorThird]: 'M3',
  [I.PerfectFourth]: 'P4',
  [I.Tritone]: 'tritone',
  [I.PerfectFifth]: 'P5',
  [I.MinorSixth]: 'm6',
  [I.MajorSixth]: 'M6',
  [I.MinorSeventh]: 'm7',
  [I.MajorSeventh]: 'M7',
  [I.Octave]: 'P8',
}
