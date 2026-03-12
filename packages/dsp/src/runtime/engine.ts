import type { AudioBuffer, Engine, Mixer } from '../types';

export class BasicEngine implements Engine {
    public readonly mixer: Mixer;
    public readonly sampleRate: number;
    public readonly blockSize: number;

    public constructor(mixer: Mixer, sampleRate: number, blockSize: number) {
        this.mixer = mixer;
        this.sampleRate = sampleRate;
        this.blockSize = blockSize;
    }

    public noteOn(
        channelId: number,
        pitch: number,
        velocity: number,
        gateOffset: number,
        expressionId: number
    ): void {
        const instrument = this.resolveInstrument(channelId);
        if (instrument !== null) {
            instrument.noteOn(pitch, velocity, gateOffset, expressionId);
        }
    }

    public noteOff(channelId: number, pitch: number, expressionId: number): void {
        const instrument = this.resolveInstrument(channelId);
        if (instrument !== null) {
            instrument.noteOff(pitch, expressionId);
        }
    }

    public controlChange(channelId: number, controller: number, value: number): void {
        const instrument = this.resolveInstrument(channelId);
        if (instrument !== null) {
            instrument.setParameter(controller, value);
        }
    }

    public render(): AudioBuffer {
        return this.mixer.render(this.blockSize);
    }

    public reset(): void {
        this.mixer.reset();
    }

    private resolveInstrument(channelId: number) {
        if (!Number.isInteger(channelId)) {
            return null;
        }
        if (channelId < 0 || channelId >= this.mixer.channels.length) {
            return null;
        }
        return this.mixer.channels[channelId].instrument;
    }
}
