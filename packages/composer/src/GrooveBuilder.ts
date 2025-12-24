/**
 * Groove template for quantization and swing.
 * Immutable builder pattern per RFC-047 Section 4.1.
 * 
 * Uses constructor parameters for zero-allocation pattern.
 */
export class GrooveBuilder {
    constructor(
        private readonly swingAmount: number = 0.5,
        private readonly stepCount: number = 4
    ) {
        // Validation in constructor
        if (swingAmount < 0 || swingAmount > 1) {
            throw new Error('Swing must be 0-1');
        }
        if (stepCount < 1) {
            throw new Error('Steps must be >= 1');
        }
    }

    /**
     * Set swing amount (0.5 = no swing, 0.66 = MPC swing).
     * Returns NEW instance (immutable).
     */
    swing(amount: number): GrooveBuilder {
        return new GrooveBuilder(amount, this.stepCount);
    }

    /**
     * Set step count (e.g., 16th notes per beat).
     * Returns NEW instance (immutable).
     */
    steps(count: number): GrooveBuilder {
        return new GrooveBuilder(this.swingAmount, count);
    }

    /**
     * Build the final groove template (frozen object).
     */
    build(): Readonly<{ swing: number; steps: number }> {
        return Object.freeze({
            swing: this.swingAmount,
            steps: this.stepCount
        });
    }
}
