import type { SiliconSynapse } from './silicon-synapse';
/**
 * Event emitted when consumer reads a node.
 */
export interface ConsumerNoteEvent {
    tick: number;
    pitch: number;
    velocity: number;
    duration: number;
    ptr: number;
}
/**
 * Mock AudioWorklet consumer for integration testing.
 *
 * Simulates the behavior of an AudioWorklet that:
 * - Advances playhead tick over time
 * - Reads nodes from the linked list
 * - Acknowledges structural changes via COMMIT_FLAG
 * - Applies groove and humanization transforms
 *
 * This is NOT for production use - it's for testing the Silicon Linker
 * in isolation before integrating with the real AudioWorklet.
 */
export declare class MockConsumer {
    private sab;
    private heapStartI32;
    private currentPtr;
    private events;
    private isRunning;
    private tickRate;
    private linker;
    constructor(buffer: SharedArrayBuffer, tickRate?: number);
    /**
     * Set the linker instance for RFC-044 command processing.
     * In real system, Worker would create its own SiliconSynapse instance.
     */
    setLinker(linker: SiliconSynapse): void;
    /**
     * Reset consumer state.
     */
    reset(): void;
    /**
     * Get collected events.
     */
    getEvents(): ConsumerNoteEvent[];
    /**
     * Get current playhead tick.
     */
    getPlayheadTick(): number;
    /**
     * Set playhead tick directly (for testing).
     */
    setPlayheadTick(tick: number): void;
    /**
     * Simulate one audio quantum (~128 frames = ~2.9ms at 44.1kHz).
     *
     * This method:
     * 0. Process pending commands from Ring Buffer (RFC-044)
     * 1. Checks for COMMIT_FLAG and acknowledges
     * 2. Advances playhead by tickRate
     * 3. Reads any nodes that fall within the current tick window
     *
     * @returns Array of events triggered in this quantum
     */
    process(): ConsumerNoteEvent[];
    /**
     * Handle COMMIT_FLAG protocol.
     * If PENDING, acknowledge and invalidate cached pointer.
     */
    private handleCommitFlag;
    /**
     * Find the node at or after current playhead.
     * Called after structural change to re-sync position.
     */
    private findNodeAtPlayhead;
    /**
     * Apply groove and humanization to get trigger tick.
     */
    private getTriggerTick;
    /**
     * Apply global transpose.
     */
    private applyTranspose;
    /**
     * Apply global velocity multiplier.
     */
    private applyVelocityMult;
    /**
     * Run consumer for N quanta, collecting all events.
     *
     * @param quanta - Number of process() calls to run
     * @returns All events collected
     */
    runQuanta(quanta: number): ConsumerNoteEvent[];
    /**
     * Run consumer until playhead reaches target tick.
     *
     * @param targetTick - Tick to run until
     * @returns All events collected
     */
    runUntilTick(targetTick: number): ConsumerNoteEvent[];
}
//# sourceMappingURL=mock-consumer.d.ts.map