import { PlasticityCallback, SynapseResolutionCallback } from '@symphonyscript/kernel';
/**
 * Playback cursor with neural branching support (RFC-045).
 *
 * The SynapticCursor extends the playback engine to support the "Silicon Brain"
 * neural topology. When a playback cursor reaches the end of a clip chain
 * (`NEXT_PTR == NULL_PTR`), it performs **Synaptic Resolution** to determine
 * the next target.
 *
 * Key Responsibilities:
 * - Hash-based synapse table lookup (O(1))
 * - Stochastic selection among multiple candidates
 * - Jitter application for humanization
 * - Quota enforcement to prevent infinite loops
 *
 * Thread Safety:
 * - Designed for Audio Thread (read-only access to Synapse Table)
 * - Uses Atomics for all SAB reads
 * - Zero-allocation hot path
 */
export declare class SynapticCursor {
    private readonly sab;
    private readonly synapseTableOffsetI32;
    private readonly capacity;
    /** Current position in the node chain (byte pointer) */
    private currentPtr;
    /** Pending jitter ticks to wait before starting next clip */
    private pendingJitter;
    /** Counter for synapses fired this block (quota enforcement) */
    private synapsesFiredThisBlock;
    /** Pre-allocated candidate targetPtr array (max 64 candidates) */
    private readonly candTargetPtrs;
    /** Pre-allocated candidate weight array */
    private readonly candWeights;
    /** Pre-allocated candidate jitter array */
    private readonly candJitters;
    /** Pre-allocated candidate synapsePtr array */
    private readonly candSynapsePtrs;
    /** PRNG state for deterministic stochastic selection */
    private prngState;
    /** RFC-045-03: Plasticity callback for automatic reward distribution */
    private plasticityCallback;
    constructor(buffer: SharedArrayBuffer, initialPtr?: number, prngSeed?: number);
    /**
     * Get the current node pointer.
     */
    getCurrentPtr(): number;
    /**
     * Set the current node pointer.
     */
    setCurrentPtr(ptr: number): void;
    /**
     * Get pending jitter (ticks to wait before starting).
     */
    getPendingJitter(): number;
    /**
     * Consume pending jitter (call after waiting).
     */
    consumeJitter(): void;
    /**
     * Check if cursor has pending jitter to wait.
     */
    hasJitter(): boolean;
    /**
     * Reset synapse fire counter (call at start of each audio block).
     */
    resetBlockQuota(): void;
    /**
     * Check if quota allows more synapse fires this block.
     */
    canFireSynapse(): boolean;
    /**
     * Set the plasticity callback for automatic reward distribution.
     *
     * RFC-045-03: Called whenever a synapse fires successfully during playback.
     * Use this to implement Hebbian learning (reward winning synapses).
     *
     * @param cb - Callback to invoke with synapsePtr, or null to disable
     */
    setPlasticityCallback(cb: PlasticityCallback | null): void;
    /**
     * Resolve synaptic connection with zero-allocation callback (RFC-045-04).
     *
     * This is the core neural branching logic (RFC-045 Section 4.1).
     * Called when `node.NEXT_PTR == NULL_PTR` to find the next target.
     *
     * **Algorithm:**
     * 1. Quota check (abort if exceeded)
     * 2. Hash SOURCE_PTR to find synapse head slot
     * 3. Collect all candidates (follow META_NEXT chain)
     * 4. Stochastic selection (weighted random)
     * 5. Apply jitter and invoke callback
     *
     * @param sourcePtr - The source node pointer (end of current clip)
     * @param cb - Callback receiving resolution result as primitives
     * @returns true if synapse was resolved, false if cursor dies (quota/no synapse)
     */
    resolveSynapseWithCallback(sourcePtr: number, cb: SynapseResolutionCallback): boolean;
    /**
     * Knuth's Multiplicative Hash (using KNUTH_HASH_CONST per RFC-045).
     */
    private hash;
    /**
     * Convert slot index to i32 offset in SAB.
     */
    private offsetForSlot;
    /**
     * Find the head slot for a source pointer using linear probing.
     * @returns Slot index, or -1 if not found
     */
    private findHeadSlot;
    /**
     * Collect all valid candidates from a synapse chain.
     *
     * Traverses the META_NEXT linked list, skipping tombstones
     * (TARGET_PTR == NULL_PTR), and populates the pre-allocated
     * SoA candidate arrays.
     *
     * @param headSlot - Starting slot for the chain
     * @returns Number of valid candidates collected, or CURSOR_ERR_CHAIN_LOOP on error
     */
    private collectCandidates;
    /**
     * Stochastic selection among candidates (weighted random).
     *
     * Uses a deterministic PRNG for reproducible results.
     * Weights are treated as relative probabilities.
     *
     * RFC-045-04: Returns index into SoA arrays instead of object reference.
     *
     * @param candidateCount - Number of valid candidates in SoA arrays
     * @returns Index of the winning candidate
     */
    private selectWinner;
    /**
     * Convert slot index to byte pointer.
     */
    private ptrFromSlot;
    /**
     * Convert byte pointer to slot index.
     */
    private slotFromPtr;
    /**
     * Simple xorshift32 PRNG for deterministic random selection.
     * Zero-allocation, fast, and reproducible.
     */
    private nextRandom;
    /**
     * Set PRNG seed for reproducible randomness.
     * Note: xorshift32 has fixpoint at 0, so zero seeds are converted to 1.
     */
    setSeed(seed: number): void;
}
//# sourceMappingURL=SynapticCursor.d.ts.map