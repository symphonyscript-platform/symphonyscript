import { GrooveStepCursor } from './GrooveStepCursor'

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
export class SynapticGrooveBuilder {
    public readonly velocities: Float32Array;
    public readonly durations: Float32Array;
    public readonly offsets: Float32Array;
    public readonly probabilities: Float32Array;
    // Config
    private _stepsPerBeat: number = 4;
    private _swing: number = 0.5;
    // Buffers (Fixed size)
    private readonly capacity: number;
    // State
    private count: number = 0;
    private cursor: GrooveStepCursor;

    constructor(capacity: number = 64) {
        this.capacity = capacity;
        this.velocities = new Float32Array(capacity).fill(1.0);
        this.durations = new Float32Array(capacity).fill(0.25);
        this.offsets = new Float32Array(capacity);
        this.probabilities = new Float32Array(capacity).fill(1.0);

        this.cursor = new GrooveStepCursor(this);
    }

    stepsPerBeat(val: number): this {
        this._stepsPerBeat = val;
        return this;
    }

    swing(val: number): this {
        this._swing = val;
        return this;
    }

    /**
     * Starts the sequential step configuration.
     * @param timing Optional offset for the first step
     */
    step(timing?: number): GrooveStepCursor {
        // Initialize new sequence at index 0
        this.count = 0;

        // Prepare cursor at index 0
        this.cursor.bind(0);

        // If timing provided, set offset
        if (timing !== undefined) {
            this.cursor.timing(timing);
        }

        this.count = 1;
        return this.cursor;
    }

    /**
     * Internal: Called by cursor to advance to next step
     */
    advance(): void {
        if (this.count >= this.capacity) {
            throw new Error(`Groove capacity exceeded (${this.capacity})`);
        }
        const nextIndex = this.count;
        this.count++;
        this.cursor.bind(nextIndex);
    }

    /**
     * Internal: Called by cursor.freeze()
     * Uses subarray (views) instead of slice to avoid Float32Array allocations.
     * @remarks Views are invalidated on builder reuse (e.g. calling step() again).
     * Callers must not mutate the returned arrays or the builder's internal buffers will be modified.
     */
    build(): GrooveTemplate {
        return {
            stepsPerBeat: this._stepsPerBeat,
            swing: this._swing,
            velocities: this.velocities.subarray(0, this.count),
            durations: this.durations.subarray(0, this.count),
            offsets: this.offsets.subarray(0, this.count),
            probabilities: this.probabilities.subarray(0, this.count),
            length: this.count
        };
    }
}
