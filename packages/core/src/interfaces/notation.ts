import { ChordIntervals, KeySignature, ScaleIntervals } from '../types'
import { Range } from './range'
import { NotationCapabilities } from './notation-capabilities'
import { ChordResolution } from './chord-resolution'

export interface Notation {
  getId(): string
  getName(): string
  getTuningHz(): number
  getPitchRange(): Range
  prefersFlats(): boolean
  getCapabilities(): NotationCapabilities

  noteToCents(input: string): number | null
  centsToNote(cents: number): string
  noteToMidi(input: string): number | null
  noteToFrequency(input: string): number
  transposeNote(note: string, cents: number): string
  isEnharmonic(a: string, b: string): boolean

  intervalToCents(input: string): number | null
  centsToInterval(cents: number): string

  getScaleIntervals(mode: string): ScaleIntervals | null
  getSupportedScales(): string[]

  getKeySignature(root: string, mode: string): KeySignature | null

  degreeToCents(input: string, scale: number[]): number | null

  chordToIntervals(input: string): ChordIntervals | null
  intervalsToChord(intervals: ChordIntervals): string | null
  getSupportedChords(): string[]

  resolveProgression(numerals: string[], scale: number[]): ChordResolution[]

  durationToTicks(input: string, ppq: number): number | null
  ticksToDuration(ticks: number, ppq: number): string
}
