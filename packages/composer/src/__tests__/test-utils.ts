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

/**
 * Minimal Notation for tests — 12-EDO Western names.
 * Implements Notation interface without @symphonyscript/notations.
 */
const testNotationImpl: Notation = {
  getId: () => 'test',
  getName: () => 'Test Notation',
  getTuningHz: () => 440,
  getPitchRange: () => ({ min: 0, max: 13200 }),
  prefersFlats: () => false,
  getCapabilities: () => ({ chords: false, degrees: true, progressions: false }),

  noteToCents(input: NoteName | number): number {
    if (typeof input === 'number') return input
    const m = input.match(/^([A-G][b#]?)(-?\d+)$/)
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
      'P4': 500, 6900: 600, 'P5': 700, 'm6': 800, 'M6': 900,
      'm7': 1000, 'M7': 1100, 'P8': 1200,
    }
    const v = map[input]
    if (v === undefined) throw new Error(`Unknown interval: ${input}`)
    return v
  },

  centsToInterval(cents: number): string {
    const names = ['P1', 'm2', 'M2', 'm3', 'M3', 'P4', 6900, 'P5', 'm6', 'M6', 'm7', 'M7']
    return names[((Math.round(cents / 100) % 12) + 12) % 12]
  },

  getScaleIntervals(mode: any): any {
    return SCALES[String(mode).toLowerCase()] ?? SCALES.major
  },

  getSupportedScales: (): any[] => ['major', 'minor'] as any[],

  getKeySignature: (_r: any, _m: any): any => ({ sharps: 0, flats: 0 } as any),

  degreeToCents(input: Degree | number, scale: number[]): number {
    if (typeof input === 'number') return input
    const d = parseInt(input, 10) - 1
    if (d < 0 || d >= scale.length) throw new Error(`Invalid degree: ${input}`)
    return scale[d]
  },

  chordToIntervals: (input: ChordSymbol | ChordIntervals): any => {
    if (Array.isArray(input)) return input
    throw new Error('Unsupported')
  },
  intervalsToChord: (_i: any): string => { throw new Error('Unsupported') },
  getSupportedChords: (): ChordSymbol[] => [],
  resolveProgression: (_n: Degree[], _s: number[]): any[] => [],

  durationToTicks(input: string, ppq: number): number {
    const map: Record<string, number> = { '1n': 4, '2n': 2, '4n': 1, '8n': 0.5, '16n': 0.25 }
    return (map[input] ?? 1) * ppq
  },

  ticksToDuration: (): string => '4n',
}

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
