import { clearBuffer, createAudioBuffer } from '../buffer-utils';
import type { AudioBuffer, DSPModule, SendBus } from '../types';

function resolveSourceChannel(targetChannel: number, sourceChannelCount: number): number {
    if (sourceChannelCount <= 1) {
        return 0;
    }
    if (targetChannel < sourceChannelCount) {
        return targetChannel;
    }
    return sourceChannelCount - 1;
}

export class BasicSendBus implements SendBus {
    public readonly id: number;
    public readonly effect: DSPModule;
    public readonly outputChannelCount: number;

    private blockSize: number;
    private accumulation: AudioBuffer;
    private output: AudioBuffer;
    private readonly effectInputBuffers: AudioBuffer[];
    private readonly effectOutputBuffers: AudioBuffer[];

    public constructor(
        id: number,
        effect: DSPModule,
        outputChannelCount: number,
        blockSize: number
    ) {
        this.id = id;
        this.effect = effect;
        this.outputChannelCount = outputChannelCount;
        this.blockSize = blockSize;
        this.accumulation = createAudioBuffer(outputChannelCount, blockSize);
        this.output = createAudioBuffer(outputChannelCount, blockSize);
        this.effectInputBuffers = [this.accumulation];
        this.effectOutputBuffers = [this.output];
    }

    public addInput(input: AudioBuffer, level: number): void {
        if (level === 0) {
            return;
        }

        const sampleCount = Math.min(this.accumulation.blockSize, input.blockSize);
        const sourceChannelCount = input.channelCount;
        const sourceData = input.data;
        const targetData = this.accumulation.data;

        for (let targetChannel = 0; targetChannel < this.outputChannelCount; targetChannel += 1) {
            const sourceChannel = resolveSourceChannel(targetChannel, sourceChannelCount);
            const sourceOffset = sourceChannel * input.blockSize;
            const targetOffset = targetChannel * this.accumulation.blockSize;
            for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
                targetData[targetOffset + sampleIndex] += sourceData[sourceOffset + sampleIndex] * level;
            }
        }
    }

    public render(blockSize: number): AudioBuffer {
        this.ensureBlockSize(blockSize);
        clearBuffer(this.output);
        this.effect.process(this.effectInputBuffers, this.effectOutputBuffers, blockSize);
        return this.output;
    }

    public clear(): void {
        clearBuffer(this.accumulation);
        clearBuffer(this.output);
    }

    private ensureBlockSize(blockSize: number): void {
        if (this.blockSize === blockSize) {
            return;
        }
        this.blockSize = blockSize;
        this.accumulation = createAudioBuffer(this.outputChannelCount, blockSize);
        this.output = createAudioBuffer(this.outputChannelCount, blockSize);
        this.effectInputBuffers[0] = this.accumulation;
        this.effectOutputBuffers[0] = this.output;
    }
}
