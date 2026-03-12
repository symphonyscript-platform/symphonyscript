import { StealPolicy } from '../constants';
import { createAudioBuffer } from '../buffer-utils';
import { BasicMixer } from '../runtime/mixer';
import type { AudioBuffer, Instrument, MixerChannel } from '../types';

const BLOCK_SIZE = 32;

class MonoConstantInstrument implements Instrument {
    public readonly name = 'mono-constant';
    public readonly maxVoices = 1;
    public readonly stealPolicy = StealPolicy.NONE;

    private readonly output: AudioBuffer;
    private amplitude: number;

    public constructor(blockSize: number, amplitude: number) {
        this.output = createAudioBuffer(1, blockSize);
        this.amplitude = amplitude;
    }

    public noteOn(
        _pitch: number,
        _velocity: number,
        _gateOffset: number,
        _expressionId: number
    ): number {
        return 0;
    }

    public noteOff(_pitch: number, _expressionId: number): void {}

    public allNotesOff(): void {}

    public setParameter(_paramId: number, _value: number): void {}

    public getParameter(_paramId: number): number {
        return 0;
    }

    public render(blockSize: number): AudioBuffer {
        const sampleCount = Math.min(blockSize, this.output.blockSize);
        for (let i = 0; i < sampleCount; i += 1) {
            this.output.data[i] = this.amplitude;
        }
        return this.output;
    }

    public getActiveVoiceCount(): number {
        return this.amplitude === 0 ? 0 : 1;
    }

    public reset(): void {}
}

function createChannel(instrument: Instrument): MixerChannel {
    return {
        instrument,
        muted: false,
        pan: 0,
        volume: 1,
        sendLevels: new Float32Array(0),
    };
}

function channelEnergy(buffer: AudioBuffer, channelIndex: number): number {
    let total = 0;
    const offset = channelIndex * buffer.blockSize;
    for (let i = 0; i < buffer.blockSize; i += 1) {
        total += Math.abs(buffer.data[offset + i]);
    }
    return total;
}

function expectFinite(buffer: AudioBuffer): void {
    for (let i = 0; i < buffer.data.length; i += 1) {
        expect(Number.isFinite(buffer.data[i])).toBe(true);
    }
}

describe('runtime mixer surround policy', () => {
    test('5.1 distributes mono source deterministically with silent LFE', () => {
        const channel = createChannel(new MonoConstantInstrument(BLOCK_SIZE, 1));
        const mixer = new BasicMixer(6, [channel], [], BLOCK_SIZE);

        const output = mixer.render(BLOCK_SIZE);
        const fl = channelEnergy(output, 0);
        const fr = channelEnergy(output, 1);
        const c = channelEnergy(output, 2);
        const lfe = channelEnergy(output, 3);
        const rl = channelEnergy(output, 4);
        const rr = channelEnergy(output, 5);

        expect(fl).toBeGreaterThan(0);
        expect(fr).toBeGreaterThan(0);
        expect(c).toBeGreaterThan(0);
        expect(rl).toBeGreaterThan(0);
        expect(rr).toBeGreaterThan(0);
        expect(lfe).toBe(0);
        expect(fl).toBeCloseTo(fr, 6);
        expect(rl).toBeCloseTo(rr, 6);
        expect(rl).toBeLessThan(fl);
        expect(c).toBeGreaterThan(fl);
    });

    test('7.1 follows deterministic front/side/rear energy pattern', () => {
        const channel = createChannel(new MonoConstantInstrument(BLOCK_SIZE, 1));
        const mixer = new BasicMixer(8, [channel], [], BLOCK_SIZE);

        const output = mixer.render(BLOCK_SIZE);
        const fl = channelEnergy(output, 0);
        const fr = channelEnergy(output, 1);
        const c = channelEnergy(output, 2);
        const lfe = channelEnergy(output, 3);
        const rl = channelEnergy(output, 4);
        const rr = channelEnergy(output, 5);
        const sl = channelEnergy(output, 6);
        const sr = channelEnergy(output, 7);

        expect(lfe).toBe(0);
        expect(fl).toBeCloseTo(fr, 6);
        expect(c).toBeGreaterThan(fl);
        expect(sl).toBeCloseTo(sr, 6);
        expect(rl).toBeCloseTo(rr, 6);
        expect(sl).toBeGreaterThan(rl);
        expect(fl).toBeGreaterThan(sl);
    });

    test('surround pan left/right changes FL and FR dominance', () => {
        const channel = createChannel(new MonoConstantInstrument(BLOCK_SIZE, 1));
        const mixer = new BasicMixer(8, [channel], [], BLOCK_SIZE);

        channel.pan = -1;
        const left = mixer.render(BLOCK_SIZE);
        const leftFl = channelEnergy(left, 0);
        const leftFr = channelEnergy(left, 1);
        const leftSl = channelEnergy(left, 6);
        const leftSr = channelEnergy(left, 7);

        channel.pan = 1;
        const right = mixer.render(BLOCK_SIZE);
        const rightFl = channelEnergy(right, 0);
        const rightFr = channelEnergy(right, 1);
        const rightSl = channelEnergy(right, 6);
        const rightSr = channelEnergy(right, 7);

        expect(leftFl).toBeGreaterThan(leftFr);
        expect(rightFr).toBeGreaterThan(rightFl);
        expect(leftSl).toBeGreaterThan(leftSr);
        expect(rightSr).toBeGreaterThan(rightSl);
    });

    test('surround outputs remain finite for clamped extreme pans', () => {
        const channel = createChannel(new MonoConstantInstrument(BLOCK_SIZE, 0.5));
        const mixer51 = new BasicMixer(6, [channel], [], BLOCK_SIZE);
        const mixer71 = new BasicMixer(8, [channel], [], BLOCK_SIZE);

        channel.pan = -2;
        expectFinite(mixer51.render(BLOCK_SIZE));
        channel.pan = 2;
        expectFinite(mixer51.render(BLOCK_SIZE));

        channel.pan = -2;
        expectFinite(mixer71.render(BLOCK_SIZE));
        channel.pan = 2;
        expectFinite(mixer71.render(BLOCK_SIZE));
    });
});
