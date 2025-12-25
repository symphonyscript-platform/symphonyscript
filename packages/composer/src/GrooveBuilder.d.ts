/**
 * Groove template for quantization and swing.
 * Immutable builder pattern per RFC-047 Section 4.1.
 *
 * Uses constructor parameters for zero-allocation pattern.
 */
export declare class GrooveBuilder {
    private readonly swingAmount;
    private readonly stepCount;
    constructor(swingAmount?: number, stepCount?: number);
    /**
     * Set swing amount (0.5 = no swing, 0.66 = MPC swing).
     * Returns NEW instance (immutable).
     */
    swing(amount: number): GrooveBuilder;
    /**
     * Set step count (e.g., 16th notes per beat).
     * Returns NEW instance (immutable).
     */
    steps(count: number): GrooveBuilder;
    /**
     * Build the final groove template (frozen object).
     */
    build(): Readonly<{
        swing: number;
        steps: number;
    }>;
}
//# sourceMappingURL=GrooveBuilder.d.ts.map