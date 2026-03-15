export interface ExecutionContext {
    /** Insert a note node. Returns node pointer or error code. */
    insertNote(
        pitch: number,
        velocity: number,
        duration: number,
        tick: number,
        muted: boolean,
        sourceId: number,
        exitId?: number,
        expressionId?: number
    ): number

    /** Insert MIDI CC event. */
    insertCC(controller: number, value: number, tick: number, sourceId: number): number

    /** Insert pitch bend event. */
    insertBend(value: number, tick: number, sourceId: number): number

    /** Create synapse connection. */
    connect(srcId: number, tgtId: number, weight?: number): void

    /** Remove synapse connection. */
    disconnect(srcId: number, tgtId: number): void

    /** Mark node for reclamation. */
    reclaim(nodePtr: number): void

    /** Get PPQ resolution. */
    getPpq(): number
}
