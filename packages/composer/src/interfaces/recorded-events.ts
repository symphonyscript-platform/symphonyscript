import type { CapturedNote } from './captured-note'

export interface RecordedNote extends CapturedNote {
  readonly sourceId: number
}

export interface RecordedCC {
  readonly controller: number
  readonly value: number
  readonly tick: number
  readonly sourceId: number
}

export interface RecordedBend {
  readonly value: number
  readonly tick: number
  readonly sourceId: number
}
