/**
 * StereoBus - Stereo Summing Bus with Pan and Volume control.
 * 
 * Responsibilities:
 * - Accumulate mono inputs into a stereo field.
 * - Apply Pan (Constant Power or Linear) during input summing.
 * - Apply Master Volume/Pan during output processing.
 * - Zero-allocation operation (pre-allocated buffers).
 */
export class StereoBus {
    private bufferL: Float32Array;
    private bufferR: Float32Array;
    private bufferSize: number;

    // Master Bus controls
    private masterVolume: number = 1.0;
    private masterPan: number = 0.0; // -1.0 (L) to 1.0 (R)

    constructor(size: number = 128) {
        this.bufferSize = size;
        this.bufferL = new Float32Array(size);
        this.bufferR = new Float32Array(size);
    }

    /**
     * Set the bus master volume (linear gain).
     * @param gain Linear gain (0.0 to 1.0+)
     */
    setVolume(gain: number): void {
        this.masterVolume = gain;
    }

    /**
     * Set the bus master pan.
     * @param pan -1.0 (Left) to 1.0 (Right)
     */
    setPan(pan: number): void {
        this.masterPan = Math.max(-1, Math.min(1, pan));
    }

    /**
     * Clear internal buffers (prepare for new block).
     */
    clear(): void {
        this.bufferL.fill(0);
        this.bufferR.fill(0);
    }

    /**
     * Mix a mono source into the bus.
     * 
     * @param source Mono input buffer
     * @param pan Input pan (-1.0 to 1.0)
     * @param gain Input gain (linear)
     */
    input(source: Float32Array, pan: number = 0.0, gain: number = 1.0): void {
        // Safety check
        if (source.length !== this.bufferSize) return;

        const panClamped = Math.max(-1, Math.min(1, pan));
        // Constant power pan (approximate)
        // 0 to PI/2 mapping
        const panMapped = (panClamped + 1) * 0.25 * Math.PI;
        // console.log(`StereoBus: pan=${pan}, clamped=${panClamped}, mapped=${panMapped}, cos=${Math.cos(panMapped)}, sin=${Math.sin(panMapped)}`);

        const gainL = Math.cos(panMapped) * gain;
        const gainR = Math.sin(panMapped) * gain;

        // Vectorized-like loop
        for (let i = 0; i < this.bufferSize; i++) {
            const sample = source[i];
            this.bufferL[i] += sample * gainL;
            this.bufferR[i] += sample * gainR;
        }
    }

    /**
     * Process the bus and write to output buffers.
     * Applies Master Volume and Master Pan.
     * 
     * @param outL Output Left buffer
     * @param outR Output Right buffer
     */
    process(outL: Float32Array, outR: Float32Array): void {
        // Apply Master Controls
        const panMapped = (this.masterPan + 1) * 0.25 * Math.PI;
        const masterGainL = Math.cos(panMapped) * this.masterVolume;
        const masterGainR = Math.sin(panMapped) * this.masterVolume;

        // Zero-alloc copy/gain
        for (let i = 0; i < this.bufferSize; i++) {
            outL[i] = this.bufferL[i] * masterGainL;
            outR[i] = this.bufferR[i] * masterGainR;
        }
    }

    /**
     * Resize internal buffers.
     * @param newSize New buffer size in frames
     */
    resize(newSize: number): void {
        if (newSize === this.bufferSize) return;
        this.bufferSize = newSize;
        this.bufferL = new Float32Array(newSize);
        this.bufferR = new Float32Array(newSize);
    }
}
