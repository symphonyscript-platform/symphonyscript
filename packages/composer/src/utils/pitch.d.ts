/**
 * Simple pitch parser for Synaptic components.
 * Zero-allocation for common inputs (numbers).
 * @remarks Cold-path operation—called once per note symbol, not per audio frame.
 */
export declare function parsePitch(input: string | number): number;
//# sourceMappingURL=pitch.d.ts.map