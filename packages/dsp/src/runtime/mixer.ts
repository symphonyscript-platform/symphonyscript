import { clearBuffer, createAudioBuffer } from '../buffer-utils';
import type { AudioBuffer, Mixer, MixerChannel, SendBus } from '../types';

function clampPan(pan: number): number {
    if (pan < -1) {
        return -1;
    }
    if (pan > 1) {
        return 1;
    }
    return pan;
}

function computePanAngle(pan: number): number {
    const normalized = (clampPan(pan) + 1) * 0.5;
    return normalized * Math.PI * 0.5;
}

function computeCenterGain(leftGain: number, rightGain: number): number {
    return (leftGain + rightGain) * 0.5;
}

function computeRearGain(frontGain: number): number {
    return frontGain * 0.35;
}

function computeSideGain(frontGain: number): number {
    return frontGain * 0.3;
}

function computeBackGain(frontGain: number): number {
    return frontGain * 0.2;
}

function sumInputSample(input: AudioBuffer, sampleIndex: number): number {
    let sum = 0;
    for (let channelIndex = 0; channelIndex < input.channelCount; channelIndex += 1) {
        const offset = channelIndex * input.blockSize;
        sum += input.data[offset + sampleIndex];
    }
    return sum;
}

export class BasicMixer implements Mixer {
    public readonly masterChannelCount: number;
    public readonly channels: MixerChannel[];
    public readonly sends: SendBus[];
    public masterVolume = 1;
    public masterPan = 0;

    private blockSize: number;
    private masterOutput: AudioBuffer;

    public constructor(
        masterChannelCount: number,
        channels: MixerChannel[],
        sends: SendBus[],
        blockSize: number
    ) {
        this.masterChannelCount = masterChannelCount;
        this.channels = channels;
        this.sends = sends;
        this.blockSize = blockSize;
        this.masterOutput = createAudioBuffer(masterChannelCount, blockSize);
    }

    public render(blockSize: number): AudioBuffer {
        this.ensureBlockSize(blockSize);
        clearBuffer(this.masterOutput);
        this.clearSends();

        for (let channelIndex = 0; channelIndex < this.channels.length; channelIndex += 1) {
            const channel = this.channels[channelIndex];
            const instrument = channel.instrument;
            if (instrument === null || channel.muted) {
                continue;
            }

            const rendered = instrument.render(blockSize);
            this.mixChannelIntoMaster(rendered, channel.volume, channel.pan);
            this.routeChannelToSends(channel, rendered);
        }

        for (let sendIndex = 0; sendIndex < this.sends.length; sendIndex += 1) {
            const sendOutput = this.sends[sendIndex].render(blockSize);
            this.mixBusIntoMaster(sendOutput);
        }

        this.applyMasterStage();
        return this.masterOutput;
    }

    public reset(): void {
        clearBuffer(this.masterOutput);
        this.clearSends();

        for (let i = 0; i < this.channels.length; i += 1) {
            const instrument = this.channels[i].instrument;
            if (instrument !== null) {
                instrument.reset();
            }
        }
    }

    private ensureBlockSize(blockSize: number): void {
        if (this.blockSize === blockSize) {
            return;
        }
        this.blockSize = blockSize;
        this.masterOutput = createAudioBuffer(this.masterChannelCount, blockSize);
    }

    private clearSends(): void {
        for (let sendIndex = 0; sendIndex < this.sends.length; sendIndex += 1) {
            this.sends[sendIndex].clear();
        }
    }

    private routeChannelToSends(channel: MixerChannel, rendered: AudioBuffer): void {
        const sendCount = Math.min(channel.sendLevels.length, this.sends.length);
        for (let sendIndex = 0; sendIndex < sendCount; sendIndex += 1) {
            const sendLevel = channel.sendLevels[sendIndex];
            if (sendLevel !== 0) {
                this.sends[sendIndex].addInput(rendered, sendLevel);
            }
        }
    }

    private mixChannelIntoMaster(rendered: AudioBuffer, volume: number, pan: number): void {
        if (this.masterChannelCount <= 0 || volume === 0) {
            return;
        }

        const dst = this.masterOutput.data;
        const inputChannelCount = rendered.channelCount;
        if (inputChannelCount <= 0) {
            return;
        }

        if (this.masterChannelCount === 1) {
            for (let sampleIndex = 0; sampleIndex < this.blockSize; sampleIndex += 1) {
                const mono = sumInputSample(rendered, sampleIndex) / inputChannelCount;
                dst[sampleIndex] += mono * volume;
            }
            return;
        }

        const angle = computePanAngle(pan);
        const leftGain = Math.cos(angle);
        const rightGain = Math.sin(angle);
        const centerGain = computeCenterGain(leftGain, rightGain);
        const leftOffset = 0 * this.blockSize;
        const rightOffset = 1 * this.blockSize;
        const centerOffset = 2 * this.blockSize;
        const lfeOffset = 3 * this.blockSize;
        const rearLeftOffset = 4 * this.blockSize;
        const rearRightOffset = 5 * this.blockSize;
        const sideLeftOffset = 6 * this.blockSize;
        const sideRightOffset = 7 * this.blockSize;
        for (let sampleIndex = 0; sampleIndex < this.blockSize; sampleIndex += 1) {
            const mono = sumInputSample(rendered, sampleIndex) / inputChannelCount;
            const base = mono * volume;
            if (this.masterChannelCount === 2) {
                // Stereo: constant-power pan between FL/FR.
                dst[leftOffset + sampleIndex] += base * leftGain;
                dst[rightOffset + sampleIndex] += base * rightGain;
                continue;
            }
            if (this.masterChannelCount === 6) {
                // 5.1 order: FL, FR, C, LFE, RL, RR.
                dst[leftOffset + sampleIndex] += base * leftGain;
                dst[rightOffset + sampleIndex] += base * rightGain;
                dst[centerOffset + sampleIndex] += base * centerGain;
                dst[lfeOffset + sampleIndex] += 0;
                dst[rearLeftOffset + sampleIndex] += base * computeRearGain(leftGain);
                dst[rearRightOffset + sampleIndex] += base * computeRearGain(rightGain);
                continue;
            }
            if (this.masterChannelCount === 8) {
                // 7.1 order: FL, FR, C, LFE, RL, RR, SL, SR.
                dst[leftOffset + sampleIndex] += base * leftGain;
                dst[rightOffset + sampleIndex] += base * rightGain;
                dst[centerOffset + sampleIndex] += base * centerGain;
                dst[lfeOffset + sampleIndex] += 0;
                dst[rearLeftOffset + sampleIndex] += base * computeBackGain(leftGain);
                dst[rearRightOffset + sampleIndex] += base * computeBackGain(rightGain);
                dst[sideLeftOffset + sampleIndex] += base * computeSideGain(leftGain);
                dst[sideRightOffset + sampleIndex] += base * computeSideGain(rightGain);
                continue;
            }

            // Deterministic fallback for uncommon layouts:
            // pan front pair, spread lower-energy center/bed, no LFE synthesis.
            dst[leftOffset + sampleIndex] += base * leftGain;
            if (this.masterChannelCount > 1) {
                dst[rightOffset + sampleIndex] += base * rightGain;
            }
            if (this.masterChannelCount > 2) {
                dst[centerOffset + sampleIndex] += base * centerGain;
            }
            if (this.masterChannelCount > 4) {
                dst[rearLeftOffset + sampleIndex] += base * computeBackGain(leftGain);
            }
            if (this.masterChannelCount > 5) {
                dst[rearRightOffset + sampleIndex] += base * computeBackGain(rightGain);
            }
            if (this.masterChannelCount > 6) {
                dst[sideLeftOffset + sampleIndex] += base * computeSideGain(leftGain);
            }
            if (this.masterChannelCount > 7) {
                dst[sideRightOffset + sampleIndex] += base * computeSideGain(rightGain);
            }
        }
    }

    private mixBusIntoMaster(sendOutput: AudioBuffer): void {
        if (this.masterChannelCount <= 0) {
            return;
        }

        const dst = this.masterOutput.data;
        for (let channelIndex = 0; channelIndex < this.masterChannelCount; channelIndex += 1) {
            const sourceChannel =
                sendOutput.channelCount === 1
                    ? 0
                    : channelIndex < sendOutput.channelCount
                      ? channelIndex
                      : sendOutput.channelCount - 1;
            const sourceOffset = sourceChannel * sendOutput.blockSize;
            const targetOffset = channelIndex * this.blockSize;
            for (let sampleIndex = 0; sampleIndex < this.blockSize; sampleIndex += 1) {
                dst[targetOffset + sampleIndex] += sendOutput.data[sourceOffset + sampleIndex];
            }
        }
    }

    private applyMasterStage(): void {
        const dst = this.masterOutput.data;
        if (this.masterChannelCount === 1) {
            for (let sampleIndex = 0; sampleIndex < this.blockSize; sampleIndex += 1) {
                dst[sampleIndex] *= this.masterVolume;
            }
            return;
        }

        const angle = computePanAngle(this.masterPan);
        const leftGain = Math.cos(angle);
        const rightGain = Math.sin(angle);
        const leftOffset = 0;
        const rightOffset = this.blockSize;
        for (let sampleIndex = 0; sampleIndex < this.blockSize; sampleIndex += 1) {
            dst[leftOffset + sampleIndex] *= this.masterVolume * leftGain;
            dst[rightOffset + sampleIndex] *= this.masterVolume * rightGain;
        }

        for (let channelIndex = 2; channelIndex < this.masterChannelCount; channelIndex += 1) {
            const channelOffset = channelIndex * this.blockSize;
            for (let sampleIndex = 0; sampleIndex < this.blockSize; sampleIndex += 1) {
                dst[channelOffset + sampleIndex] *= this.masterVolume;
            }
        }
    }
}
