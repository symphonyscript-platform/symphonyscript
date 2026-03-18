/**
 * Test utilities for the Composition API.
 *
 * Pattern:
 *   1. Create a bridge:         const bridge = createBridge({ velocity: 600 })
 *   2. Apply steps:             const result = note(6000).apply(bridge)
 *   3. Capture committed output: const { notes, cc, bends } = commitAndCapture(result)
 *   4. Assert on captured data:  expect(notes[0].tick).toBe(0)
 */

import { BaseCompositionBridge } from '../composition/BaseCompositionBridge'
import type { BaseCompositionBridgeParams } from '../composition/BaseCompositionBridge'
import { RecordingBridge } from '../composition/RecordingBridge'
import type { RecordedNote, RecordedCC, RecordedBend } from '../interfaces/recorded-events'
import { CompositionBridge } from '../interfaces/composition-bridge'
import type { Notation, NoteName, IntervalName, Degree, ChordSymbol, ChordIntervals } from '@symphonyscript/core'

// ============================================================================
// Test Notation — minimal 12-EDO stub
// ============================================================================

/** Note name → base cents within one octave */
const NOTE_BASE: Record<string, number> = {
  'C': 0, 'C#': 100, 'Db': 100,
  'D': 200, 'D#': 300, 'Eb': 300,
  'E': 400,
  'F': 500, 'F#': 600, 'Gb': 600,
  'G': 700, 'G#': 800, 'Ab': 800,
  'A': 900, 'A#': 1000, 'Bb': 1000,
  'B': 1100,
}

const PC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const SCALES: Record<string, readonly number[]> = {
  'major': [0, 200, 400, 500, 700, 900, 1100],
  'minor': [0, 200, 300, 500, 700, 800, 1000],
}

/** Roman numeral → 0-based scale degree index */
const ROMAN_TO_DEGREE: Record<string, number> = {
  'I': 0, 'II': 1, 'III': 2, 'IV': 3, 'V': 4, 'VI': 5, 'VII': 6,
}

/** Chord quality suffix → intervals in cents from root */
const TEST_CHORD_MAP: Record<string, number[]> = {
  '':    [0, 400, 700],       // major triad
  'm':   [0, 300, 700],       // minor triad
  'dim': [0, 300, 600],       // diminished triad
  'aug': [0, 400, 800],       // augmented triad
  '7':   [0, 400, 700, 1000], // dominant 7th
  'maj7':[0, 400, 700, 1100], // major 7th
  'm7':  [0, 300, 700, 1000], // minor 7th
}

/**
 * Parse a roman numeral like 'V7', 'bVII', 'ii', 'iv7' into components.
 * Returns the 0-based degree index, accidental, and chord quality suffix.
 */
function parseTestRoman(input: string): { degreeIndex: number; accidental: string; quality: string; isLowercase: boolean } {
  const m = input.match(/^([b#]?)([IViv]+)(.*)$/)
  if (!m) throw new Error(`Invalid roman numeral: ${input}`)
  const accidental = m[1]
  const numeral = m[2]
  const suffix = m[3]

  const isLowercase = numeral === numeral.toLowerCase()
  const upper = numeral.toUpperCase()
  const degreeIndex = ROMAN_TO_DEGREE[upper]
  if (degreeIndex === undefined) throw new Error(`Unknown roman numeral: ${numeral}`)

  // Determine quality: lowercase implies minor, suffix overrides
  let quality = suffix
  if (isLowercase) {
    if (!suffix.startsWith('m') && !suffix.startsWith('dim')) {
      if (suffix === '') {
        quality = 'm'
      } else if (suffix.length > 0 && suffix[0] >= '0' && suffix[0] <= '9') {
        // ii7 → m7, vi9 → m9
        quality = 'm' + suffix
      }
    }
  }

  return { degreeIndex, accidental, quality, isLowercase }
}

/**
 * Minimal Notation for tests — 12-EDO Western names.
 * Implements Notation interface without @symphonyscript/notations.
 */
const testNotationImpl = {
  getId: () => 'test',
  getName: () => 'Test Notation',
  getTuningHz: () => 440,
  getPitchRange: () => ({ min: 0, max: 13200 }),
  prefersFlats: () => false,
  getCapabilities: () => ({ chords: true, degrees: true, progressions: true }),

  noteToCents(input: NoteName | number): number {
    if (typeof input === 'number') return input
    const m = (input as string).match(/^([A-G][b#]?)(-?\d+)$/)
    if (!m) throw new Error(`Invalid note: ${input}`)
    const base = NOTE_BASE[m[1]]
    if (base === undefined) throw new Error(`Unknown note: ${m[1]}`)
    return (parseInt(m[2], 10) + 1) * 1200 + base
  },

  centsToNote(cents: number): string {
    const semi = Math.round(cents / 100)
    const oct = Math.floor(semi / 12) - 1
    return PC_NAMES[((semi % 12) + 12) % 12] + oct
  },

  noteToMidi(input: NoteName): number {
    return Math.round(testNotationImpl.noteToCents(input) / 100)
  },

  noteToFrequency(input: NoteName): number {
    const cents = testNotationImpl.noteToCents(input)
    return 440 * Math.pow(2, (cents - 5700) / 1200) // A4 = 5700 cents
  },

  transposeNote(input: NoteName, cents: number): string {
    return testNotationImpl.centsToNote(testNotationImpl.noteToCents(input) + cents)
  },

  isEnharmonic(a: NoteName, b: NoteName): boolean {
    return testNotationImpl.noteToCents(a) === testNotationImpl.noteToCents(b)
  },

  intervalToCents(input: IntervalName | number): number {
    if (typeof input === 'number') return input
    const map: Record<string, number> = {
      'P1': 0, 'm2': 100, 'M2': 200, 'm3': 300, 'M3': 400,
      'P4': 500, 'A4': 600, 'P5': 700, 'm6': 800, 'M6': 900,
      'm7': 1000, 'M7': 1100, 'P8': 1200,
    }
    const v = map[input]
    if (v === undefined) throw new Error(`Unknown interval: ${input}`)
    return v
  },

  centsToInterval(cents: number): string {
    const names = ['P1', 'm2', 'M2', 'm3', 'M3', 'P4', 'A4', 'P5', 'm6', 'M6', 'm7', 'M7']
    return names[((Math.round(cents / 100) % 12) + 12) % 12]
  },

  getScaleIntervals(mode: any): any {
    return SCALES[String(mode).toLowerCase()] ?? SCALES.major
  },

  getSupportedScales: (): any[] => ['major', 'minor'] as any[],

  getKeySignature: (_r: any, _m: any): any => ({ sharps: 0, flats: 0 } as any),

  degreeToCents(input: Degree | number, scale: number[]): number {
    if (typeof input === 'number') return input
    const parsed = parseTestRoman(String(input))
    if (parsed.degreeIndex >= scale.length) throw new Error(`Invalid degree: ${input}`)
    let cents = scale[parsed.degreeIndex]
    if (parsed.accidental === 'b') cents -= 100
    else if (parsed.accidental === '#') cents += 100
    return cents
  },

  chordToIntervals: (input: ChordSymbol | ChordIntervals): any => {
    if (Array.isArray(input)) return input
    throw new Error(`Unsupported chord symbol in test notation: ${input}`)
  },
  intervalsToChord: (_i: any): string => { throw new Error('Unsupported') },
  getSupportedChords: (): ChordSymbol[] => [],
  resolveProgression(numerals: Degree[], scale: number[]): any[] {
    return numerals.map(numeral => {
      const parsed = parseTestRoman(String(numeral))
      let rootCents = scale[parsed.degreeIndex]
      if (parsed.accidental === 'b') rootCents -= 100
      else if (parsed.accidental === '#') rootCents += 100
      const intervals = TEST_CHORD_MAP[parsed.quality]
      if (!intervals) throw new Error(`Unknown chord quality '${parsed.quality}' from numeral '${numeral}'`)
      return { rootCents, intervals }
    })
  },

  durationToTicks(input: string, ppq: number): number {
    const map: Record<string, number> = { '1n': 4, '2n': 2, '4n': 1, '8n': 0.5, '16n': 0.25 }
    return (map[input] ?? 1) * ppq
  },

  ticksToDuration: (): string => '4n',
} as unknown as Notation

// ============================================================================
// Shared test notation instance
// ============================================================================

export const testNotation: Notation = testNotationImpl

// ============================================================================
// Bridge Factory
// ============================================================================

/**
 * Create a fresh BaseCompositionBridge with optional overrides.
 * Uses testNotation as the default notation.
 */
export function createBridge(
  overrides: Partial<BaseCompositionBridgeParams> = {},
): BaseCompositionBridge {
  return new BaseCompositionBridge({ notation: testNotation, ...overrides })
}

// ============================================================================
// Commit + Capture
// ============================================================================

export interface CapturedOutput {
  notes: RecordedNote[]
  cc: RecordedCC[]
  bends: RecordedBend[]
}

/**
 * Commit a composed bridge to a RecordingBridge and return captured events.
 */
export function commitAndCapture(bridge: CompositionBridge): CapturedOutput {
  const recorder = new RecordingBridge()
  bridge.commit(recorder)

  const notes: RecordedNote[] = []
  const cc: RecordedCC[] = []
  const bends: RecordedBend[] = []

  const frozen = recorder.toFrozenClip()

  frozen.visitNotes((sourceId, pitch, velocity, duration, tick, muted) => {
    notes.push({ sourceId, pitch, velocity, duration, tick, muted })
  })

  frozen.visitCC((sourceId, controller, value, tick) => {
    cc.push({ sourceId, controller, value, tick })
  })

  frozen.visitBends((sourceId, value, tick) => {
    bends.push({ sourceId, value, tick })
  })

  return { notes, cc, bends }
}
