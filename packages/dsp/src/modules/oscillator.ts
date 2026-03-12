import { ModuleType, PortRate } from '../constants';
import type { AudioBuffer, DSPModule, PortDescriptor } from '../types';

const TWO_PI = Math.PI * 2;
const MIN_FREQUENCY = 1e-6;
const MIN_PULSE_WIDTH = 1e-6;
const MAX_PULSE_WIDTH = 1 - MIN_PULSE_WIDTH;
const DEFAULT_SAMPLE_RATE = 48000;

const EMPTY_INPUTS: readonly PortDescriptor[] = [];
const OSCILLATOR_OUTPUTS: readonly PortDescriptor[] = [
    {
        id: 0,
        rate: PortRate.AUDIO,
        channelCount: 1,
        name: 'out',
    },
];

export const OscillatorWaveform = {
    SINE: 0,
    SAW: 1,
    SQUARE: 2,
    TRIANGLE: 3,
} as const;

export type OscillatorWaveform = (typeof OscillatorWaveform)[keyof typeof OscillatorWaveform];

export const OscillatorParam = {
    FREQUENCY: 0,
    DETUNE_CENTS: 1,
    WAVEFORM: 2,
    PULSE_WIDTH: 3,
} as const;

export type OscillatorParam = (typeof OscillatorParam)[keyof typeof OscillatorParam];

function sanitizeFrequency(value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
        return MIN_FREQUENCY;
    }
    return value;
}

function sanitizeDetuneCents(value: number): number {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return value;
}

function sanitizePulseWidth(value: number): number {
    if (!Number.isFinite(value)) {
        return 0.5;
    }
    if (value <= MIN_PULSE_WIDTH) {
        return MIN_PULSE_WIDTH;
    }
    if (value >= MAX_PULSE_WIDTH) {
        return MAX_PULSE_WIDTH;
    }
    return value;
}

function sanitizeWaveform(value: number): OscillatorWaveform {
    if (!Number.isFinite(value)) {
        return OscillatorWaveform.SINE;
    }
    const waveform = Math.trunc(value);
    if (waveform <= OscillatorWaveform.SINE) {
        return OscillatorWaveform.SINE;
    }
    if (waveform >= OscillatorWaveform.TRIANGLE) {
        return OscillatorWaveform.TRIANGLE;
    }
    return waveform as OscillatorWaveform;
}

function normalizePhase(phase: number): number {
    if (phase >= TWO_PI || phase < 0) {
        phase %= TWO_PI;
        if (phase < 0) {
            phase += TWO_PI;
        }
    }
    return phase;
}

export class OscillatorModule implements DSPModule {
    public readonly type = ModuleType.OSCILLATOR;
    public readonly id: number;
    public readonly inputs = EMPTY_INPUTS;
    public readonly outputs = OSCILLATOR_OUTPUTS;

    private sampleRate: number;
    private phase = 0;
    private frequency = 440;
    private detuneCents = 0;
    private waveform: OscillatorWaveform = OscillatorWaveform.SINE;
    private pulseWidth = 0.5;

    constructor(id: number, sampleRate = DEFAULT_SAMPLE_RATE) {
        this.id = id;
        this.sampleRate = sanitizeFrequency(sampleRate);
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
        const sampleRate = this.sampleRate;
        const pulsePhase = TWO_PI * this.pulseWidth;
        const detuneRatio = Math.pow(2, this.detuneCents / 1200);
        const phaseIncrement = (TWO_PI * this.frequency * detuneRatio) / sampleRate;
        const waveform = this.waveform;
        let phase = this.phase;

        for (let i = 0; i < blockSize; i += 1) {
            let sample = 0;
            if (waveform === OscillatorWaveform.SINE) {
                sample = Math.sin(phase);
            } else if (waveform === OscillatorWaveform.SAW) {
                sample = phase / Math.PI - 1;
            } else if (waveform === OscillatorWaveform.SQUARE) {
                sample = phase < pulsePhase ? 1 : -1;
            } else {
                const normalized = phase / TWO_PI;
                sample = 1 - 4 * Math.abs(normalized - 0.5);
            }

            data[i] = sample;
            phase += phaseIncrement;
            if (phase >= TWO_PI || phase < 0) {
                phase = normalizePhase(phase);
            }
        }

        this.phase = normalizePhase(phase);
    }

    public setParameter(paramId: number, value: number): void {
        if (paramId === OscillatorParam.FREQUENCY) {
            this.frequency = sanitizeFrequency(value);
            return;
        }
        if (paramId === OscillatorParam.DETUNE_CENTS) {
            this.detuneCents = sanitizeDetuneCents(value);
            return;
        }
        if (paramId === OscillatorParam.WAVEFORM) {
            this.waveform = sanitizeWaveform(value);
            return;
        }
        if (paramId === OscillatorParam.PULSE_WIDTH) {
            this.pulseWidth = sanitizePulseWidth(value);
        }
    }

    public getParameter(paramId: number): number {
        if (paramId === OscillatorParam.FREQUENCY) {
            return this.frequency;
        }
        if (paramId === OscillatorParam.DETUNE_CENTS) {
            return this.detuneCents;
        }
        if (paramId === OscillatorParam.WAVEFORM) {
            return this.waveform;
        }
        if (paramId === OscillatorParam.PULSE_WIDTH) {
            return this.pulseWidth;
        }
        return 0;
    }

    public reset(): void {
        this.phase = 0;
    }
}
