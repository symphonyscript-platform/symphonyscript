/**
 * Read-only snapshot of a committed composition. Immutable capture of notes,
 * CC events, and pitch bends. Produced by {@link freeze} and {@link RecordingBridge.toFrozenClip}.
 */
export interface IFrozenClip {
  /** Number of notes in the snapshot. */
  readonly noteCount: number

  /** End of the clip in ticks (max of note end-tick, CC tick, and bend tick). */
  readonly duration: number

  /**
   * Invoke callback for each note in the snapshot.
   *
   * @param cb - Callback invoked per note. Receives: sourceId (source slot id),
   *   pitch (MIDI 0–127), velocity (millivels 0–1270), duration (ticks), tick (ticks), muted.
   */
  visitNotes(
    cb: (sourceId: number, pitch: number, velocity: number,
         duration: number, tick: number, muted: boolean) => void
  ): void

  /**
   * Invoke callback for each CC event in the snapshot.
   *
   * @param cb - Callback invoked per CC event. Receives: sourceId (source slot id),
   *   controller (MIDI CC 0–127), value (0–127), tick (ticks).
   */
  visitCC(
    cb: (sourceId: number, controller: number, value: number, tick: number) => void
  ): void

  /**
   * Invoke callback for each pitch bend in the snapshot.
   *
   * @param cb - Callback invoked per bend event. Receives: sourceId (source slot id),
   *   value (14-bit pitch bend, typically -8192 to 8191), tick (ticks).
   */
  visitBends(
    cb: (sourceId: number, value: number, tick: number) => void
  ): void
}
