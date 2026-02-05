import { SiliconBridge } from '@symphonyscript/kernel';
/**
 * SynapticNode - The fundamental unit of the SymphonyScript topology.
 *
 * Represents a generic "neuron" in the graph that can:
 * 1. Hold a connection to the Kernel (SiliconBridge).
 * 2. Track its topology identity (Entry/Exit Source IDs).
 * 3. Form synaptic connections to other nodes.
 * 4. Manage phase-locking / cycling behavior.
 *
 * This class is content-agnostic. It knows nothing about music, notes, or data types.
 */
export declare abstract class SynapticNode {
    protected bridge: SiliconBridge;
    protected entryId: number | undefined;
    protected exitId: number | undefined;
    protected cycle: number;
    protected barrierId: number | undefined;
    protected barrierPtr: number | undefined;
    protected writeId: number | undefined;
    constructor(bridge: SiliconBridge);
    /**
     * Link this node's output to another node's input.
     *
     * @param target - The target node to connect to.
     * @param weight - Synaptic weight (0-1000).
     * @param jitter - Timing jitter in milliseconds (or ticks, depending on kernel).
     */
    linkTo(target: SynapticNode, weight?: number, jitter?: number): this;
    /**
     * Alias for linkTo.
     */
    connect(target: SynapticNode, weight?: number, jitter?: number): this;
    /**
     * [RFC-054] Set the phase-locking cycle length.
     *
     * This method manages the BARRIER node for implicit loop topology:
     * - If ticks <= 0: Remove existing barrier (un-loop)
     * - If barrier exists: Update its duration (idempotent)
     * - If no barrier: Insert new BARRIER node and close loop
     *
     * @param ticks - Cycle length in ticks. 0 or negative removes the cycle.
     */
    setCycle(ticks: number): void;
    /**
     * Get the entry source ID (input/dendrite).
     */
    getEntryId(): number;
    /**
     * Get the exit source ID (output/axon).
     */
    getExitId(): number;
}
//# sourceMappingURL=SynapticNode.d.ts.map