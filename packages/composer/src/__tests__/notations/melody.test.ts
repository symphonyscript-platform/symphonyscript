/**
 * Melody cue Tests — trill, grace, glissando, tuplet, polyrhythm
 *
 * Tests melody cue functions that return builders (TrillBuilder, NoteBuilder,
 * GlissandoBuilder, TupletBuilder, PolyrhythmBuilder) and their apply behavior.
 */

import { describe, it, expect } from 'vitest'
import {
  trill,
  grace,
  glissando,
  tuplet,
  polyrhythm,
} from '../../cues/melody'
import { TrillBuilder } from '../../builders/TrillBuilder'
import { GlissandoBuilder } from '../../builders/GlissandoBuilder'
import { TupletBuilder } from '../../builders/TupletBuilder'
import { PolyrhythmBuilder } from '../../builders/PolyrhythmBuilder'
import { NoteBuilder } from '../../builders/NoteBuilder'
import { createBridge, commitAndCapture } from '../test-utils'
import { note } from '../../cues/note'

describe('melody', () => {
  describe('trill', () => {
    it('trill() should return TrillBuilder', () => {
      const result = trill()
      expect(result).toBeInstanceOf(TrillBuilder)
    })

    it('trill(upperPitch, basePitch, rate?, duration?) should alternate between pitches', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      // trill(pitch=upper, basePitch=base). Alternates: base, pitch, base, pitch...
      const result = trill('E4', 'C4', 120, 480).apply(bridge)

      const { notes } = commitAndCapture(result)
      // 480/120 = 4 hits. i=0 base(C4), i=1 pitch(E4), i=2 base(C4), i=3 pitch(E4)
      expect(notes).toHaveLength(4)
      expect(notes[0].pitch).toBe(60) // C4
      expect(notes[1].pitch).toBe(64) // E4
      expect(notes[2].pitch).toBe(60)
      expect(notes[3].pitch).toBe(64)
      notes.forEach((n) => expect(n.duration).toBe(120))
    })

    it('should use bridge defaultDuration for rate and duration when omitted', () => {
      const bridge = createBridge({ defaultDuration: 240 })
      const result = trill('D4', 'C4').apply(bridge)

      const { notes } = commitAndCapture(result)
      // rate=240, duration=240 -> 1 hit (base only)
      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(60) // base first
    })

    it('should advance tick by total duration', () => {
      const bridge = createBridge({ tick: 0, defaultDuration: 480 })
      const result = trill('E4', 'C4', 120, 480).apply(bridge)
      expect(result.tick).toBe(480)
    })

    it('should space trill hits sequentially', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = trill('E4', 'C4', 240, 480).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(240)
    })

    it('trill without pitch/basePitch should return bridge unchanged', () => {
      const bridge = createBridge({ tick: 100, defaultDuration: 480 })
      const result = trill().apply(bridge)
      expect(result.tick).toBe(100)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
    })

    it('.pitch() .basePitch() .rate() .duration() builder chaining', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = trill()
        .pitch('G4')
        .basePitch('C4')
        .rate(160)
        .duration(480)
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3) // 480/160
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(67)
    })
  })

  describe('grace', () => {
    it('grace(pitch?, graceDuration) should return NoteBuilder', () => {
      const result = grace('C4', 30)
      expect(result).toBeInstanceOf(NoteBuilder)
    })

    it('grace() without pitch should return NoteBuilder with duration only', () => {
      const result = grace(undefined, 20)
      expect(result).toBeInstanceOf(NoteBuilder)
    })

    it('grace(pitch, graceDuration) should emit short note before main note', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      let b = grace('E4', 30).apply(bridge)
      b = note('C4').apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(2)
      expect(notes[0].pitch).toBe(64) // grace E4
      expect(notes[0].duration).toBe(30)
      expect(notes[1].pitch).toBe(60) // main C4
      expect(notes[1].duration).toBe(480)
    })

    it('grace() without pitch should emit short note with default pitch', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = grace(undefined, 40).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0].duration).toBe(40)
      expect(notes[0].pitch).toBe(60) // NoteBuilder defaults to C4
    })

    it('should use default graceDuration 30 when omitted', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = grace('C4').apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0].duration).toBe(30)
      expect(notes[0].pitch).toBe(60)
    })
  })

  describe('glissando', () => {
    it('glissando() should return GlissandoBuilder', () => {
      const result = glissando()
      expect(result).toBeInstanceOf(GlissandoBuilder)
    })

    it('glissando(from, to, duration?) should emit chromatic slide', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = glissando('C4', 'E4', 240).apply(bridge)

      const { notes } = commitAndCapture(result)
      // C4=60, E4=64 -> 4 semitones, 5 notes (60,61,62,63,64)
      expect(notes).toHaveLength(5)
      expect(notes[0].pitch).toBe(60)
      expect(notes[notes.length - 1].pitch).toBe(64)
      expect(notes[1].pitch).toBe(61)
      expect(notes[2].pitch).toBe(62)
    })

    it('glissando downward should emit descending chromatic notes', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = glissando('G4', 'C4', 200).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].pitch).toBe(67)
      expect(notes[notes.length - 1].pitch).toBe(60)
    })

    it('glissando same pitch should emit single note', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = glissando('C4', 'C4', 240).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(60)
    })

    it('should use bridge defaultDuration when duration omitted', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = glissando('C4', 'D4').apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3) // C4, C#4, D4
      notes.forEach((n) => expect(n.duration).toBeGreaterThan(0))
    })

    it('glissando without from/to should return bridge unchanged', () => {
      const bridge = createBridge({ tick: 50 })
      const result = glissando().apply(bridge)
      expect(result.tick).toBe(50)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
    })
  })

  describe('tuplet', () => {
    it('tuplet(count?, inBeats?) should return TupletBuilder', () => {
      const result = tuplet()
      expect(result).toBeInstanceOf(TupletBuilder)
    })

    it('tuplet(3, 2).steps(...) should fit 3 notes into 2 beats', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = tuplet(3, 2)
        .steps(note('C4'), note('E4'), note('G4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      // totalDuration = 2 * 480 = 960, scaledDuration = 960/3 = 320 per note
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(64)
      expect(notes[2].pitch).toBe(67)
      expect(notes[0].duration).toBe(320)
      expect(notes[1].duration).toBe(320)
      expect(notes[2].duration).toBe(320)
    })

    it('tuplet without steps should return bridge unchanged', () => {
      const bridge = createBridge({ tick: 0 })
      const result = tuplet(3, 2).apply(bridge)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
    })

    it('tuplet should advance tick by total duration (inBeats * defaultDuration)', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = tuplet(3, 2)
        .steps(note('C4'), note('E4'), note('G4'))
        .apply(bridge)
      expect(result.tick).toBe(960) // 2 * 480
    })
  })

  describe('polyrhythm', () => {
    it('polyrhythm(noteCount?, overBeats?) should return PolyrhythmBuilder', () => {
      const result = polyrhythm()
      expect(result).toBeInstanceOf(PolyrhythmBuilder)
    })

    it('polyrhythm(3, 2).steps(...) should evenly space 3 notes over 2 beats', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = polyrhythm(3, 2)
        .steps(note('C4'), note('E4'), note('G4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(64)
      expect(notes[2].pitch).toBe(67)
      expect(notes[0].duration).toBe(320) // 960/3
    })

    it('polyrhythm without steps should return bridge unchanged', () => {
      const bridge = createBridge({ tick: 0 })
      const result = polyrhythm(3, 2).apply(bridge)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
    })

    it('polyrhythm should advance tick by total duration', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = polyrhythm(3, 2)
        .steps(note('C4'), note('E4'), note('G4'))
        .apply(bridge)
      expect(result.tick).toBe(960)
    })
  })
})
