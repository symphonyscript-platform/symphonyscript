import type { NodePtr } from './types';
/**
 * Attribute patcher for immediate, sub-millisecond node updates.
 *
 * These operations:
 * - Do NOT require COMMIT_FLAG (consumer sees changes on next read)
 * - DO increment SEQ counter for ABA protection
 * - Are atomic at the individual field level
 *
 * Thread safety:
 * - Each patch is a single Atomics.store (atomic for aligned i32)
 * - SEQ increment ensures consumer detects the change
 */
export declare class AttributePatcher {
    private sab;
    private heapStartI32;
    private nodeCapacity;
    constructor(sab: Int32Array, nodeCapacity: number);
    /**
     * Convert a byte pointer to i32 index within the SAB.
     */
    private ptrToI32Index;
    /**
     * Get the i32 offset for a node given its byte pointer.
     */
    nodeOffset(ptr: NodePtr): number;
    /**
     * Validate that a pointer is within the heap bounds and properly aligned.
     * RFC-045-04: Returns false instead of throwing.
     */
    private validatePtr;
    /**
     * Increment the SEQ counter for ABA protection.
     * Called before any attribute mutation.
     */
    private bumpSeq;
    /**
     * Patch the pitch attribute (bits 16-23 of PACKED_A).
     * RFC-045-04: Returns boolean instead of throwing.
     *
     * @param ptr - Node byte pointer
     * @param pitch - New pitch value (0-127)
     * @returns true on success, false on invalid pointer
     */
    patchPitch(ptr: NodePtr, pitch: number): boolean;
    /**
     * Patch the velocity attribute (bits 8-15 of PACKED_A).
     * RFC-045-04: Returns boolean instead of throwing.
     *
     * @param ptr - Node byte pointer
     * @param velocity - New velocity value (0-127)
     * @returns true on success, false on invalid pointer
     */
    patchVelocity(ptr: NodePtr, velocity: number): boolean;
    /**
     * Patch the duration attribute.
     * RFC-045-04: Returns boolean instead of throwing.
     *
     * @param ptr - Node byte pointer
     * @param duration - New duration in ticks
     * @returns true on success, false on invalid pointer
     */
    patchDuration(ptr: NodePtr, duration: number): boolean;
    /**
     * Patch the base tick attribute.
     * RFC-045-04: Returns boolean instead of throwing.
     *
     * @param ptr - Node byte pointer
     * @param baseTick - New base tick (grid-aligned timing)
     * @returns true on success, false on invalid pointer
     */
    patchBaseTick(ptr: NodePtr, baseTick: number): boolean;
    /**
     * Set or clear the MUTED flag.
     * RFC-045-04: Returns boolean instead of throwing.
     *
     * @param ptr - Node byte pointer
     * @param muted - Whether the node should be muted
     * @returns true on success, false on invalid pointer
     */
    patchMuted(ptr: NodePtr, muted: boolean): boolean;
    /**
     * Patch the source ID (editor location hash).
     * RFC-045-04: Returns boolean instead of throwing.
     *
     * @param ptr - Node byte pointer
     * @param sourceId - New source ID
     * @returns true on success, false on invalid pointer
     */
    patchSourceId(ptr: NodePtr, sourceId: number): boolean;
    /**
     * Patch multiple attributes at once (batch update).
     * More efficient than individual patches when changing multiple fields.
     * RFC-045-04: Returns boolean instead of throwing.
     *
     * @param ptr - Node byte pointer
     * @param updates - Object with optional pitch, velocity, duration, baseTick, muted
     * @returns true on success, false on invalid pointer
     */
    patchMultiple(ptr: NodePtr, updates: {
        pitch?: number;
        velocity?: number;
        duration?: number;
        baseTick?: number;
        muted?: boolean;
        sourceId?: number;
    }): boolean;
}
//# sourceMappingURL=patch.d.ts.map