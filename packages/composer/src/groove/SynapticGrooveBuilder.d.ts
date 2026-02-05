import { GrooveStepCursor } from './GrooveStepCursor';
export interface GrooveTemplate {
    stepsPerBeat: number;
    swing: number;
    velocities: Float32Array;
    durations: Float32Array;
    offsets: Float32Array;
    probabilities: Float32Array;
    length: number;
}
/**
 * SynapticGrooveBuilder
 * RFC-049 Section 5.3
 * Sequential Mutable Builder Pattern
 */
export declare class SynapticGrooveBuilder {
    private _stepsPerBeat;
    private _swing;
    private readonly capacity;
    readonly velocities: Float32Array;
    readonly durations: Float32Array;
    readonly offsets: Float32Array;
    readonly probabilities: Float32Array;
    private count;
    private cursor;
    constructor(capacity?: number);
    stepsPerBeat(val: number): this;
    swing(val: number): this;
    /**
     * Starts the sequential step configuration.
     * @param timing Optional offset for the first step
     */
    step(timing?: number): GrooveStepCursor;
    /**
     * Internal: Called by cursor to advance to next step
     */
    advance(): void;
    /**
     * Internal: Called by cursor.freeze()
     */
    build(): GrooveTemplate;
}
//# sourceMappingURL=SynapticGrooveBuilder.d.ts.map