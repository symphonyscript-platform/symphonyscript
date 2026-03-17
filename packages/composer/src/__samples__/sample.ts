import { Clip } from '@symphonyscript/composer'
import {
  note, rest, chord, degree,
  stack, loop, use,
  crescendo, decrescendo,
  swing, humanize, quantize,
  tie, glide, arpeggio,
  scale, velocity, tempo, duration, octaveUp, octaveDown,
  kick, snare, hihat, openHat, crash, ride, flam,
  drumPattern, drumEuclidean,
  progression,
} from '../index'
import { ScaleMode, PitchClass } from '@symphonyscript/notations'

// ─── Config ───
const Q = 480         // quarter
const H = Q * 2       // half
const W = Q * 4       // whole
const E = Q / 2       // eighth

// ─── Components ───

const pianoChords = Clip.pipe(
  scale(PitchClass.D, 'minor'),
  velocity(700).default(),
  progression(['i', 'VI', 'III', 'VII']).duration(W),
)

const bassline = Clip.pipe(
  octaveDown().default(),
  duration(Q).default(),
  degree(1), degree(1), rest(Q), degree(6),
  degree(3), rest(Q), degree(3), degree(7),
)

const melody = Clip.pipe(
  velocity(800).default(),
  duration(Q).default(),

  // Phrase A
  note('D5', H), note('F5'),  note('A5'),
  note('G5', H), rest(Q),     note('F5'),

  // Phrase B — echo, softer
  velocity(500).steps(
    note('D5', H), note('F5'), note('A5'),
  ),
  note('E5', W),
)

const melodyWithFeel = Clip.pipe(
  humanize(15, 8).default(),
  swing(0.55).default(),
  use(melody),
)

const arpeggioBreak = Clip.pipe(
  arpeggio(['D4', 'F4', 'A4', 'C5'], E)
    .pattern('upDown')
    .octaves(2)
    .gate(0.7),
)

const groove = Clip.pipe(
  duration(Q).default(),
  loop(4,
    kick(), hihat().ghost(), snare(), hihat(),
    kick(), hihat().ghost(), kick(), openHat(),
  ),
)

const fill = Clip.pipe(
  crescendo(Q * 2).steps(
    flam(), snare(), snare(), snare(),
    snare().accent(), crash(),
  ),
)

// ─── Arrangement ───

const intro = Clip.pipe(
  tempo(92).default(),
  scale(PitchClass.D, ScaleMode.MINOR).default(),
  duration(Q).default(),

  // 4 bars — piano alone with arpeggiated intro
  use(arpeggioBreak),
  rest(W),
)

const verse = Clip.pipe(
  stack()
    .branch(use(pianoChords))
    .branch(use(bassline))
    .branch(use(melodyWithFeel))
    .branch(use(groove)),
)

const chorus = Clip.pipe(
  velocity(850).default(),
  crescendo(W).default(),

  stack()
    .branch(use(pianoChords))
    .branch(
      octaveUp().steps(use(melody)),
    )
    .branch(use(groove), use(fill)),
)

const outro = Clip.pipe(
  decrescendo(W * 2).default(),
  stack()
    .branch(
      tie(
        chord('Dm', W), chord('Dm', W),   // sustained Dm over 2 bars
      ),
    )
    .branch(
      glide(note('A5'), note('F5'), note('D5', W)),
    ),
)

// ─── Song ───

const song = Clip.pipe(
  use(intro),
  loop(2, use(verse)),
  use(chorus),
  use(verse),
  use(chorus),
  use(outro),
)
