/**
 * Simple chord parser and bitmask packer.
 * Zero-allocation for result structure (returns nothing, caller uses bitmask).
 *
 * Defines common chord qualities for RFC-049 compliance.
 */
/**
 * Result container for parseChord (reusable to avoid allocations).
 */
export interface ChordResult {
    root: number;
    mask: number;
}
/**
 * Parses chord symbol and writes result to out-parameter.
 * @remarks Zero-allocation by reusing module-level result object.
 */
export declare function parseChord(symbol: string, out?: ChordResult): ChordResult;
/**
 * Returns packed mask from intervals.
 */
export declare function packIntervals(intervals: number[]): number;
//# sourceMappingURL=chord.d.ts.map