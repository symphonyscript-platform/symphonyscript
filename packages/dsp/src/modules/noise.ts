import { ModuleType, PortRate } from '../constants';
import type { AudioBuffer, DSPModule, PortDescriptor } from '../types';

const NOISE_INPUTS: readonly PortDescriptor[] = [];
const NOISE_OUTPUTS: readonly PortDescriptor[] = [
    {
        id: 0,
        rate: PortRate.AUDIO,
        channelCount: 1,
        name: 'out',
    },
];

export const NoiseWaveform = {
    WHITE: 0,
    PINK: 1,
} as const;

export type NoiseWaveform = (typeof NoiseWaveform)[keyof typeof NoiseWaveform];

export const NoiseParam = {
    WAVEFORM: 0,
    AMPLITUDE: 1,
} as const;

export type NoiseParam = (typeof NoiseParam)[keyof typeof NoiseParam];

const DEFAULT_AMPLITUDE = 1.0;

// Paul Kellett economy pink noise (3 coefficients, ~±0.5 dB accuracy)
const PINK_B0 = 0.99765;
const PINK_B1 = 0.963;
const PINK_B2 = 0.57;
const PINK_C0 = 0.099046;
const PINK_C1 = 0.2965164;
const PINK_C2 = 1.0526913;
const PINK_WHITE_SCALE = 0.1848;

function sanitizeWaveform(value: number): NoiseWaveform {
    if (!Number.isFinite(value)) {
        return NoiseWaveform.WHITE;
    }
    const w = Math.trunc(value);
    return w === NoiseWaveform.PINK ? NoiseWaveform.PINK : NoiseWaveform.WHITE;
}

function sanitizeAmplitude(value: number): number {
    if (!Number.isFinite(value) || value < 0) {
        return 0;
    }
    return value > 1 ? 1 : value;
}

function whiteSample(): number {
    return 2 * Math.random() - 1;
}

export class NoiseModule implements DSPModule {
    public readonly type = ModuleType.NOISE;
    public readonly id: number;
    public readonly inputs = NOISE_INPUTS;
    public readonly outputs = NOISE_OUTPUTS;

    private waveform: NoiseWaveform = NoiseWaveform.WHITE;
    private amplitude = DEFAULT_AMPLITUDE;
    private pinkB0 = 0;
    private pinkB1 = 0;
    private pinkB2 = 0;

    constructor(id: number) {
        this.id = id;
    }

    public process(
        _inputBuffers: readonly AudioBuffer[],
        outputBuffers: readonly AudioBuffer[],
        blockSize: number
    ): void {
        if (outputBuffers.length === 0 || blockSize <= 0) {
            return;
        }

        const output = outputBuffers[0];
        if (!output || output.data.length < blockSize) {
            return;
        }

        const data = output.data;
        const amp = this.amplitude;
        const waveform = this.waveform;

        if (waveform === NoiseWaveform.WHITE) {
            for (let i = 0; i < blockSize; i += 1) {
                data[i] = whiteSample() * amp;
            }
        } else {
            let b0 = this.pinkB0;
            let b1 = this.pinkB1;
            let b2 = this.pinkB2;

            for (let i = 0; i < blockSize; i += 1) {
                const white = whiteSample();
                b0 = PINK_B0 * b0 + white * PINK_C0;
                b1 = PINK_B1 * b1 + white * PINK_C1;
                b2 = PINK_B2 * b2 + white * PINK_C2;
                data[i] = (b0 + b1 + b2 + white * PINK_WHITE_SCALE) * amp;
            }

            this.pinkB0 = b0;
            this.pinkB1 = b1;
            this.pinkB2 = b2;
        }
    }

    public setParameter(paramId: number, value: number): void {
        if (paramId === NoiseParam.WAVEFORM) {
            this.waveform = sanitizeWaveform(value);
            return;
        }
        if (paramId === NoiseParam.AMPLITUDE) {
            this.amplitude = sanitizeAmplitude(value);
        }
    }

    public getParameter(paramId: number): number {
        if (paramId === NoiseParam.WAVEFORM) {
            return this.waveform;
        }
        if (paramId === NoiseParam.AMPLITUDE) {
            return this.amplitude;
        }
        return 0;
    }

    public reset(): void {
        this.pinkB0 = 0;
        this.pinkB1 = 0;
        this.pinkB2 = 0;
    }
}
