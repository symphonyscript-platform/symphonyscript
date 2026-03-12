export enum WaveType {
    Sine = 0,
    Sawtooth = 1,
    Square = 2,
    Triangle = 3
}

const PI = Math.PI;
const TWO_PI = 2 * PI;

export class PolyOscillator {
    // Fixed polyphony limit
    private static MAX_VOICES = 32;

    // SoA (Structure of Arrays) for verify cache locality and zero-alloc
    private active: Uint8Array = new Uint8Array(PolyOscillator.MAX_VOICES);
    private phases: Float32Array = new Float32Array(PolyOscillator.MAX_VOICES);
    private increments: Float32Array = new Float32Array(PolyOscillator.MAX_VOICES);
    private frequencies: Float32Array = new Float32Array(PolyOscillator.MAX_VOICES);
    private amplitudes: Float32Array = new Float32Array(PolyOscillator.MAX_VOICES);
    private offsets: Int32Array = new Int32Array(PolyOscillator.MAX_VOICES);

    // Global parameters
    private sampleRate: number = 44100;
    private waveType: WaveType = WaveType.Sine;

    constructor(sampleRate: number = 44100) {
        this.sampleRate = sampleRate;
        this.reset();
    }

    public setSampleRate(rate: number): void {
        this.sampleRate = rate;
        // Recalculate increments if needed, though usually done on note-on
        for (let i = 0; i < PolyOscillator.MAX_VOICES; i++) {
            if (this.active[i]) {
                this.increments[i] = (this.frequencies[i] * TWO_PI) / this.sampleRate;
            }
        }
    }

    public reset(): void {
        for (let i = 0; i < PolyOscillator.MAX_VOICES; i++) {
            this.active[i] = 0;
            this.phases[i] = 0;
            this.increments[i] = 0;
            this.frequencies[i] = 0;
            this.amplitudes[i] = 0;
            this.offsets[i] = 0;
        }
    }

    public noteOn(voiceIndex: number, frequency: number, velocity: number = 1.0, sampleOffset: number = 0): void {
        if (voiceIndex >= PolyOscillator.MAX_VOICES) return;

        this.active[voiceIndex] = 1;
        this.frequencies[voiceIndex] = frequency;
        this.amplitudes[voiceIndex] = velocity;
        this.increments[voiceIndex] = (frequency * TWO_PI) / this.sampleRate;
        this.offsets[voiceIndex] = sampleOffset;

        // Optional: Reset phase? For now, let's keep it running or reset. 
        // Synth convention: Reset implies hard sync. Let's not reset for now, or maybe we should.
        // Let's no-op phase reset for "legato" feel, or explicitly reset if we want "pluck".
        // Use 0 for now for verification cleanness.
        // this.phases[voiceIndex] = 0; 
    }

    public noteOff(voiceIndex: number): void {
        if (voiceIndex >= PolyOscillator.MAX_VOICES) return;
        this.active[voiceIndex] = 0;
        this.offsets[voiceIndex] = 0;
    }

    public setWaveType(type: WaveType): void {
        this.waveType = type;
    }

    // THE HOT LOOP: ZERO ALLOCATION
    public process(output: Float32Array): void {
        const bufferSize = output.length;

        // Clear buffer first (or we assume it's additive? Usually process writes fresh)
        // If we want to stack, we should assume input is 0 or add to it. 
        // Web Audio API 'output' channels are zeroed by default if not strictly passed as input.
        // But for safety let's fill/add. 
        // Standard Processor: output is provided. We write to it.
        output.fill(0);

        for (let v = 0; v < PolyOscillator.MAX_VOICES; v++) {
            if (this.active[v] === 0) continue;

            let phase = this.phases[v];
            const increment = this.increments[v];
            const amp = this.amplitudes[v];
            const offset = this.offsets[v];

            // Local loop optimization
            for (let i = 0; i < bufferSize; i++) {
                // SAMPLE ACCURACY: Skip frames before offset
                if (i < offset) {
                    continue;
                }

                let sample = 0;

                // Branchless selection would be faster, but switch is okay for JIT
                // Logic based on waveType
                switch (this.waveType) {
                    case WaveType.Sine:
                        sample = Math.sin(phase);
                        break;
                    case WaveType.Sawtooth:
                        // Naive Sawtooth: (phase / PI) - 1. Phase is 0..2PI
                        // Need checking phase wrap
                        // Normalized phase: phase / 2PI -> 0..1
                        // Saw: 2 * (normalized) - 1
                        sample = 2 * (phase / TWO_PI) - 1;
                        break;
                    case WaveType.Square:
                        sample = phase < PI ? 1 : -1;
                        break;
                    case WaveType.Triangle:
                        // 2/PI * asin(sin(phase)) is expensive.
                        // Linear approach: 
                        // value varies 0->1->0->-1->0
                        const t = phase / TWO_PI; // 0..1
                        sample = 2 * Math.abs(2 * t - 1) - 1; // Triangle wave?
                        // Standard triangle: 4 * abs(t - 0.5) - 1
                        sample = 4 * Math.abs(t - 0.5) - 1;
                        break;
                }

                output[i] += sample * amp;

                phase += increment;
                if (phase >= TWO_PI) {
                    phase -= TWO_PI;
                }
            }

            // Write back phase
            this.phases[v] = phase;
            // Clear offset for next block (assume continuously playing from sample 0)
            this.offsets[v] = 0;
        }
    }
}
