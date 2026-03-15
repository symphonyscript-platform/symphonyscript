export interface IFrozenClip {
  readonly noteCount: number
  readonly duration: number

  visitNotes(
    cb: (sourceId: number, pitch: number, velocity: number,
         duration: number, tick: number, muted: boolean) => void
  ): void

  visitCC(
    cb: (sourceId: number, controller: number, value: number, tick: number) => void
  ): void

  visitBends(
    cb: (sourceId: number, value: number, tick: number) => void
  ): void
}
