import type { LinkerConfig } from './types';
/**
 * Create and initialize a new SharedArrayBuffer for the Silicon Linker.
 *
 * The buffer is fully initialized with:
 * - Magic number and version
 * - Configuration values (PPQ, BPM, safe zone)
 * - Empty node chain (HEAD_PTR = NULL)
 * - Full free list (all nodes linked)
 * - Zeroed groove template region
 *
 * @param config - Optional configuration overrides
 * @returns Initialized SharedArrayBuffer
 */
export declare function createLinkerSAB(config?: LinkerConfig): SharedArrayBuffer;
/**
 * Validate that a SharedArrayBuffer has the correct Silicon Linker format.
 *
 * @param buffer - Buffer to validate
 * @returns true if valid, false otherwise
 */
export declare function validateLinkerSAB(buffer: SharedArrayBuffer): boolean;
/**
 * Get configuration values from an existing SAB.
 *
 * @param buffer - Initialized SharedArrayBuffer
 * @returns Configuration extracted from the buffer
 */
export declare function getLinkerConfig(buffer: SharedArrayBuffer): Required<LinkerConfig>;
/**
 * Reset an existing SAB to initial state.
 * Clears all nodes and resets to empty chain with full free list.
 *
 * WARNING: This is NOT thread-safe. Only call when no other threads
 * are accessing the buffer.
 *
 * @param buffer - SharedArrayBuffer to reset
 */
export declare function resetLinkerSAB(buffer: SharedArrayBuffer): void;
/**
 * Write a groove template to the SAB.
 *
 * RFC-045-04: Accepts ArrayLike<number> (both number[] and Int32Array).
 *
 * Groove template format in SAB:
 * - [0] Length (number of steps)
 * - [1..N] Tick offsets for each step
 *
 * @param buffer - SharedArrayBuffer
 * @param templateIndex - Which template slot (0-based)
 * @param offsets - ArrayLike of tick offsets for each step
 * @param count - Number of offsets to write (if less than offsets.length)
 */
export declare function writeGrooveTemplate(buffer: SharedArrayBuffer, templateIndex: number, offsets: ArrayLike<number>, count?: number): void;
/**
 * Read a groove template from the SAB.
 *
 * RFC-045-04: Zero-allocation API - caller provides output array.
 * For backward compatibility (tests), can be called without output array.
 *
 * @param buffer - SharedArrayBuffer
 * @param templateIndex - Which template slot (0-based)
 * @param outOffsets - Pre-allocated Int32Array to receive offsets (optional for tests)
 * @returns Number of offsets read (if outOffsets provided), or array of offsets (if not)
 */
export declare function readGrooveTemplate(buffer: SharedArrayBuffer, templateIndex: number, outOffsets?: Int32Array): number | number[];
//# sourceMappingURL=init.d.ts.map