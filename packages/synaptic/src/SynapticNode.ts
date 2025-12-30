import { SiliconBridge, OPCODE } from '@symphonyscript/kernel';

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
export abstract class SynapticNode {
    protected entryId: number | undefined;
    protected exitId: number | undefined;
    protected cycle: number = Infinity; // Default: No phase locking (infinite cycle)

    // [RFC-054] Phase Barrier tracking for implicit loops
    protected barrierId: number | undefined;  // Source ID of BARRIER node
    protected barrierPtr: number | undefined; // Raw pointer for async ops
    protected writeId: number | undefined;    // Last content node (for splicing)

    constructor(protected bridge: SiliconBridge) { }

    /**
     * Link this node's output to another node's input.
     * 
     * @param target - The target node to connect to.
     * @param weight - Synaptic weight (0-1000).
     * @param jitter - Timing jitter in milliseconds (or ticks, depending on kernel).
     */
    linkTo(target: SynapticNode, weight?: number, jitter?: number): this {
        if (this.exitId === undefined) {
            throw new Error('Cannot link: source node has no exit ID (topology not established)');
        }

        const targetEntry = target.getEntryId();

        // RFC-054: Use flat arguments for zero-allocation
        this.bridge.connect(this.exitId, targetEntry, weight, jitter);
        return this;
    }

    /**
     * Alias for linkTo.
     */
    connect(target: SynapticNode, weight?: number, jitter?: number): this {
        return this.linkTo(target, weight, jitter);
    }

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
    setCycle(ticks: number): void {
        this.cycle = ticks;

        if (ticks <= 0) {
            // Remove cycle
            if (this.barrierPtr !== undefined) {
                this.bridge.deleteAsync(this.barrierPtr);

                // Remove loop synapse: BARRIER → Entry (source → target)
                if (this.entryId !== undefined) {
                    const entryPtr = this.bridge.getNodePtr(this.entryId);
                    if (entryPtr !== undefined) {
                        this.bridge.disconnectAsync(this.barrierPtr, entryPtr);
                    }
                }

                this.barrierId = undefined;
                this.barrierPtr = undefined;
            }
            return;
        }

        if (this.barrierId !== undefined) {
            // Update existing barrier duration (type is string 'duration')
            this.bridge.patchDirect(this.barrierId, 'duration', ticks);
        } else {
            // Insert new barrier
            const sourceId = this.bridge.generateSourceId();

            // Insert BARRIER after writeId (or at end of chain)
            // OPCODE.BARRIER = 0x05, pitch=0, velocity=0, duration=ticks, baseTick=0
            const ptr = this.bridge.insertAsync(
                OPCODE.BARRIER,
                0,      // pitch (unused)
                0,      // velocity (unused)
                ticks,  // duration = cycle length
                0,      // baseTick = 0 (evaluated dynamically)
                false,  // muted
                sourceId,
                this.writeId ?? this.exitId // Insert after writeId, fallback to exitId
            );

            if (ptr < 0) {
                throw new Error(`Failed to allocate BARRIER node: ${ptr}`);
            }

            this.barrierId = sourceId;
            this.barrierPtr = ptr;

            // Connect barrier to entry (loop closure)
            // Synapse direction: BARRIER → Entry (source → target)
            if (this.entryId !== undefined) {
                const entryPtr = this.bridge.getNodePtr(this.entryId);
                if (entryPtr !== undefined) {
                    this.bridge.connectAsync(ptr, entryPtr, 500, 0);
                }
            }
        }
    }

    /**
     * Get the entry source ID (input/dendrite).
     */
    getEntryId(): number {
        if (this.entryId === undefined) {
            throw new Error('Node has no entry ID assigned');
        }
        return this.entryId;
    }

    /**
     * Get the exit source ID (output/axon).
     */
    getExitId(): number {
        if (this.exitId === undefined) {
            throw new Error('Node has no exit ID assigned');
        }
        return this.exitId;
    }

    // [RFC-054] enforcePhase() REMOVED - Phase enforcement is now handled by 
    // the BARRIER mechanism in setCycle(). The Kernel evaluates phase alignment
    // at runtime, eliminating the need for build-time spacer calculation.
}
