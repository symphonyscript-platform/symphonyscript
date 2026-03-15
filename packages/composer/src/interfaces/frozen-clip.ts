export interface IFrozenClip {
  readonly noteCount: number
  readonly duration: number

  visitNotes(
    cb: (sourceId: number, pitch: number, velocity: number,
         duration: number, tick: number, muted: boolean) => void
  ): void
}
