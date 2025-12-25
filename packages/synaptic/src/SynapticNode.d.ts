import type { SiliconBridge } from '@symphonyscript/kernel';
/**
 * SynapticNode - Clean low-level wrapper around SiliconBridge.
 *
 * Tracks entry and exit source IDs for building note chains and
 * creating synaptic connections between builders.
 */
export declare class SynapticNode {
    private bridge;
    private entryId;
    private exitId;
    private expressionId;
    private cycle;
    /**
     * Create a new SynapticNode.
     *
     * @param bridge - Instance of SiliconBridge from @symphonyscript/core
     */
    constructor(bridge: SiliconBridge);
    /**
     * Set the MPE Expression ID for subsequent notes.
     * @param id - Expression ID (0-15)
     */
    setExpressionId(id: number): void;
    /**
     * Set the phase-locking cycle length.
     * @param ticks - Cycle length in ticks (or Infinity)
     */
    setCycle(ticks: number): void;
    /**
     * Add a note to the builder's chain.
     *
     * Zero-allocation implementation: no temporary arrays or objects.
     *
     * @param pitch - MIDI pitch (0-127)
     * @param velocity - MIDI velocity (0-127)
     * @param duration - Duration in ticks
     * @param baseTick - Start tick position
     * @param muted - Optional mute state (default: false)
     */
    addNote(pitch: number, velocity: number, duration: number, baseTick: number, muted?: boolean): void;
    /**
     * Link this builder to a target builder via synaptic connection.
     *
     * Creates a synapse from this builder's exit to the target's entry.
     *
     * @param target - Target SynapticNode to link to
     * @param weight - Optional synapse weight (0-1000, default: 500)
     * @param jitter - Optional jitter in ticks (0-65535, default: 0)
     */
    linkTo(target: SynapticNode, weight?: number, jitter?: number): void;
    /**
     * Get the source ID of the first note added to this builder.
     *
     * @returns The entry source ID
     * @throws Error if no notes have been added
     */
    getEntryId(): number;
    /**
     * Get the source ID of the last note added to this builder.
     *
     * @returns The exit source ID
     * @throws Error if no notes have been added
     */
    getExitId(): number;
}
//# sourceMappingURL=SynapticNode.d.ts.map