import { ModuleType, PortRate, StealPolicy } from '../constants';
import { createAudioBuffer } from '../buffer-utils';
import { BasicSendBus } from '../runtime/send-bus';
import { BasicMixer } from '../runtime/mixer';
import { BasicEngine } from '../runtime/engine';
import type { AudioBuffer, DSPModule, Instrument, MixerChannel, PortDescriptor } from '../types';

const BLOCK_SIZE = 32;
const SAMPLE_RATE = 48000;

const NO_PORTS: readonly PortDescriptor[] = [];

class PassthroughEffect implements DSPModule {
    public readonly type = ModuleType.OUTPUT;
    public readonly id = 1000;
    public readonly inputs = NO_PORTS;
    public readonly outputs = NO_PORTS;

    public process(
        inputBuffers: readonly AudioBuffer[],
        outputBuffers: readonly AudioBuffer[],
        blockSize: number
    ): void {
        const input = inputBuffers[0];
        const output = outputBuffers[0];
        const channelCount = output.channelCount;
        for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
            const sourceChannel =
                input.channelCount === 1
                    ? 0
                    : channelIndex < input.channelCount
                      ? channelIndex
                      : input.channelCount - 1;
            const sourceOffset = sourceChannel * input.blockSize;
            const targetOffset = channelIndex * output.blockSize;
            for (let sampleIndex = 0; sampleIndex < blockSize; sampleIndex += 1) {
                output.data[targetOffset + sampleIndex] = input.data[sourceOffset + sampleIndex];
            }
        }
    }

    public setParameter(_paramId: number, _value: number): void {}

    public getParameter(_paramId: number): number {
        return 0;
    }

    public reset(): void {}
}

class ConstantInstrument implements Instrument {
    public readonly name = 'constant';
    public readonly maxVoices = 1;
    public readonly stealPolicy = StealPolicy.NONE;

    public noteOnCalls = 0;
    public noteOffCalls = 0;
    public setParameterCalls = 0;
    public resetCalls = 0;

    private readonly output: AudioBuffer;
    private amplitude: number;

    public constructor(channelCount: number, blockSize: number, amplitude: number) {
        this.output = createAudioBuffer(channelCount, blockSize);
        this.amplitude = amplitude;
    }

    public setAmplitude(amplitude: number): void {
        this.amplitude = amplitude;
    }

    public noteOn(
        _pitch: number,
        _velocity: number,
        _gateOffset: number,
        _expressionId: number
    ): number {
        this.noteOnCalls += 1;
        return 0;
    }

    public noteOff(_pitch: number, _expressionId: number): void {
        this.noteOffCalls += 1;
    }

    public allNotesOff(): void {}

    public setParameter(_paramId: number, _value: number): void {
        this.setParameterCalls += 1;
    }

    public getParameter(_paramId: number): number {
        return 0;
    }

    public render(blockSize: number): AudioBuffer {
        const sampleCount = Math.min(blockSize, this.output.blockSize);
        for (let channelIndex = 0; channelIndex < this.output.channelCount; channelIndex += 1) {
            const channelOffset = channelIndex * this.output.blockSize;
            for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
                this.output.data[channelOffset + sampleIndex] = this.amplitude;
            }
        }
        return this.output;
    }

    public getActiveVoiceCount(): number {
        return this.amplitude === 0 ? 0 : 1;
    }

    public reset(): void {
        this.resetCalls += 1;
    }
}

function createChannel(instrument: Instrument | null, sendCount: number): MixerChannel {
    return {
        instrument,
        muted: false,
        pan: 0,
        volume: 1,
        sendLevels: new Float32Array(sendCount),
    };
}

function sumAbs(data: Float32Array): number {
    let total = 0;
    for (let i = 0; i < data.length; i += 1) {
        total += Math.abs(data[i]);
    }
    return total;
}

describe('runtime mixer + engine', () => {
    test('mixer sums two instruments into non-zero output', () => {
        const instrumentA = new ConstantInstrument(1, BLOCK_SIZE, 0.25);
        const instrumentB = new ConstantInstrument(1, BLOCK_SIZE, 0.5);
        const channels: MixerChannel[] = [
            createChannel(instrumentA, 0),
            createChannel(instrumentB, 0),
        ];
        const mixer = new BasicMixer(1, channels, [], BLOCK_SIZE);

        const output = mixer.render(BLOCK_SIZE);
        expect(sumAbs(output.data)).toBeGreaterThan(0);
    });

    test('muted channel contributes nothing', () => {
        const instrument = new ConstantInstrument(1, BLOCK_SIZE, 1);
        const channel = createChannel(instrument, 0);
        channel.muted = true;
        const mixer = new BasicMixer(1, [channel], [], BLOCK_SIZE);

        const output = mixer.render(BLOCK_SIZE);
        expect(sumAbs(output.data)).toBe(0);
    });

    test('stereo pan sends more energy left and right appropriately', () => {
        const instrument = new ConstantInstrument(1, BLOCK_SIZE, 1);
        const channel = createChannel(instrument, 0);
        const mixer = new BasicMixer(2, [channel], [], BLOCK_SIZE);

        channel.pan = -1;
        const leftHeavy = mixer.render(BLOCK_SIZE);
        const leftEnergyWhenLeft = sumAbs(leftHeavy.data.subarray(0, BLOCK_SIZE));
        const rightEnergyWhenLeft = sumAbs(leftHeavy.data.subarray(BLOCK_SIZE, BLOCK_SIZE * 2));
        expect(leftEnergyWhenLeft).toBeGreaterThan(rightEnergyWhenLeft);

        channel.pan = 1;
        const rightHeavy = mixer.render(BLOCK_SIZE);
        const leftEnergyWhenRight = sumAbs(rightHeavy.data.subarray(0, BLOCK_SIZE));
        const rightEnergyWhenRight = sumAbs(rightHeavy.data.subarray(BLOCK_SIZE, BLOCK_SIZE * 2));
        expect(rightEnergyWhenRight).toBeGreaterThan(leftEnergyWhenRight);
    });

    test('send bus contributes additional signal to master', () => {
        const instrument = new ConstantInstrument(1, BLOCK_SIZE, 1);
        const dryChannel = createChannel(instrument, 0);
        const dryMixer = new BasicMixer(1, [dryChannel], [], BLOCK_SIZE);
        const dryOutput = dryMixer.render(BLOCK_SIZE);
        const dryEnergy = sumAbs(dryOutput.data);

        const sendChannel = createChannel(instrument, 1);
        sendChannel.sendLevels[0] = 1;
        const send = new BasicSendBus(1, new PassthroughEffect(), 1, BLOCK_SIZE);
        const wetMixer = new BasicMixer(1, [sendChannel], [send], BLOCK_SIZE);
        const wetOutput = wetMixer.render(BLOCK_SIZE);
        const wetEnergy = sumAbs(wetOutput.data);

        expect(wetEnergy).toBeGreaterThan(dryEnergy);
    });

    test('engine noteOn/noteOff/controlChange route by channel id without throw', () => {
        const instrumentA = new ConstantInstrument(1, BLOCK_SIZE, 0.1);
        const instrumentB = new ConstantInstrument(1, BLOCK_SIZE, 0.2);
        const mixer = new BasicMixer(
            1,
            [createChannel(instrumentA, 0), createChannel(instrumentB, 0)],
            [],
            BLOCK_SIZE
        );
        const engine = new BasicEngine(mixer, SAMPLE_RATE, BLOCK_SIZE);

        expect(() => {
            engine.noteOn(1, 64, 0.8, 0, 10);
            engine.noteOff(1, 64, 10);
            engine.controlChange(1, 74, 0.5);
            engine.noteOn(-1, 60, 1, 0, 0);
            engine.noteOff(99, 60, 0);
            engine.controlChange(99, 1, 0.2);
        }).not.toThrow();

        expect(instrumentA.noteOnCalls).toBe(0);
        expect(instrumentB.noteOnCalls).toBe(1);
        expect(instrumentA.noteOffCalls).toBe(0);
        expect(instrumentB.noteOffCalls).toBe(1);
        expect(instrumentA.setParameterCalls).toBe(0);
        expect(instrumentB.setParameterCalls).toBe(1);
    });

    test('engine render returns block-size-consistent buffer', () => {
        const mixer = new BasicMixer(2, [createChannel(new ConstantInstrument(1, BLOCK_SIZE, 0.5), 0)], [], BLOCK_SIZE);
        const engine = new BasicEngine(mixer, SAMPLE_RATE, BLOCK_SIZE);

        const output = engine.render();
        expect(output.blockSize).toBe(BLOCK_SIZE);
        expect(output.channelCount).toBe(2);
        expect(output.data.length).toBe(BLOCK_SIZE * 2);
    });
});
