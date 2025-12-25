export declare const RING_ERR: {
    readonly OK: 0;
    readonly FULL: -1;
    readonly NOT_INITIALIZED: -2;
};
/**
 * Ring Buffer Controller for Command Ring (RFC-044).
 *
 * This class manages the atomic Head/Tail pointers and data region of the
 * Command Ring Buffer, enabling lock-free communication between Main Thread
 * (producer) and Worker Thread (consumer).
 *
 * **Protocol:**
 * - **Main Thread (Producer):** Calls `write()` to enqueue commands
 * - **Worker Thread (Consumer):** Calls `read()` to dequeue commands
 *
 * **Memory Layout:**
 * - `HDR.RB_HEAD`: Read index (Worker)
 * - `HDR.RB_TAIL`: Write index (Main Thread)
 * - `HDR.RB_CAPACITY`: Buffer capacity in commands
 * - `HDR.COMMAND_RING_PTR`: Byte offset to data region
 * - Data Region: capacity × 4 × i32 (16 bytes per command)
 *
 * **Command Format:**
 * - [0] OPCODE: Command type (INSERT, DELETE, PATCH, CLEAR)
 * - [1] PARAM_1: First parameter (e.g., node pointer)
 * - [2] PARAM_2: Second parameter (e.g., prev pointer)
 * - [3] RESERVED: Reserved for future use
 *
 * @remarks
 * This is a single-producer, single-consumer (SPSC) lock-free queue.
 * Full condition: (tail + 1) % capacity === head
 * Empty condition: head === tail
 */
export declare class RingBuffer {
    private readonly sab;
    private readonly dataStartI32;
    private readonly capacity;
    /**
     * Create a Ring Buffer Controller.
     *
     * @param sab - SharedArrayBuffer as Int32Array view
     *
     * @remarks
     * RFC-044 Hygiene: The ring buffer header fields are initialized by init.ts.
     * This constructor merely loads the pre-formatted values from the SAB.
     * This ensures the Worker can safely access the ring buffer even if the Main Thread
     * hasn't instantiated RingBuffer yet.
     */
    /** Initialization error code (0 = OK) */
    readonly initError: number;
    constructor(sab: Int32Array);
    /**
     * Write a command to the ring buffer (Main Thread / Producer).
     *
     * RFC-045-04: Returns error code instead of throwing.
     *
     * @param opcode - Command opcode (INSERT, DELETE, PATCH, CLEAR)
     * @param param1 - First parameter (e.g., node pointer)
     * @param param2 - Second parameter (e.g., prev pointer)
     * @returns RING_ERR.OK on success, RING_ERR.FULL if buffer is full
     *
     * @remarks
     * This method uses atomic operations to ensure thread-safe communication.
     * The Worker must process commands fast enough to prevent overflow.
     */
    write(opcode: number, param1: number, param2: number): number;
    /**
     * Read a command from the ring buffer (Worker Thread / Consumer).
     *
     * @param outCommand - Int32Array[4] to receive the command data
     * @returns true if command was read, false if buffer is empty
     *
     * @remarks
     * This method uses atomic operations to ensure thread-safe communication.
     * The output array must be pre-allocated to avoid allocations in the hot path.
     */
    read(outCommand: Int32Array): boolean;
    /**
     * Check if the ring buffer is empty.
     *
     * @returns true if no commands are pending
     */
    isEmpty(): boolean;
    /**
     * Check if the ring buffer is full.
     *
     * @returns true if buffer cannot accept more commands
     */
    isFull(): boolean;
    /**
     * Get the number of pending commands in the buffer.
     *
     * @returns Number of commands waiting to be processed
     */
    getPendingCount(): number;
    /**
     * Get the capacity of the ring buffer.
     *
     * @returns Maximum number of commands that can be queued
     */
    getCapacity(): number;
}
//# sourceMappingURL=ring-buffer.d.ts.map