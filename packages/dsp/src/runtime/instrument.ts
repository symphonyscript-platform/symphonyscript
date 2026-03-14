import { StealPolicy, VoiceState } from '../constants';
import type { StealPolicy as StealPolicyValue } from '../constants';
import { createAudioBuffer } from '../buffer-utils';
import type { AudioBuffer, Instrument } from '../types';
import { BasicVoice } from './voice';

function midiPitchToFrequency(pitch: number): number {
    return 440 * Math.pow(2, (pitch - 69) / 12);
}

export class BasicInstrument implements Instrument {
    public readonly name: string;
    public readonly maxVoices: number;
    public readonly stealPolicy: StealPolicyValue;

    private readonly voiceFactory: () => BasicVoice;
    private readonly voices: BasicVoice[];
    private readonly noteAges: Int32Array;
    private readonly voicePitch: Int32Array;
    private readonly voiceExpression: Int32Array;
    private readonly parameters = new Map<number, number>();

    private output: AudioBuffer | null = null;
    private noteCounter = 1;

    public constructor(
        name: string,
        maxVoices: number,
        stealPolicy: StealPolicyValue,
        voiceFactory: () => BasicVoice
    ) {
        this.name = name;
        this.maxVoices = maxVoices;
        this.stealPolicy = stealPolicy;
        this.voiceFactory = voiceFactory;
        this.voices = new Array<BasicVoice>(maxVoices);
        this.noteAges = new Int32Array(maxVoices);
        this.voicePitch = new Int32Array(maxVoices);
        this.voiceExpression = new Int32Array(maxVoices);

        for (let i = 0; i < maxVoices; i += 1) {
            this.voices[i] = this.voiceFactory();
            this.voicePitch[i] = -1;
            this.voiceExpression[i] = -1;
        }
    }

    public noteOn(
        pitch: number,
        velocity: number,
        gateOffset: number,
        expressionId: number
    ): number {
        let voiceIndex = this.findIdleVoice();
        if (voiceIndex < 0) {
            if (this.stealPolicy === StealPolicy.NONE) {
                return -1;
            }
            voiceIndex = this.selectVoiceToSteal();
        }

        const voice = this.voices[voiceIndex];
        const reusedVoice = voice.state !== VoiceState.IDLE;
        if (reusedVoice) {
            voice.prepareStealRetrigger();
        }
        voice.pitch = pitch;
        voice.expressionId = expressionId;
        voice.noteOn(midiPitchToFrequency(pitch), velocity, gateOffset);

        this.voicePitch[voiceIndex] = pitch;
        this.voiceExpression[voiceIndex] = expressionId;
        this.noteAges[voiceIndex] = this.noteCounter;
        this.noteCounter += 1;
        return voiceIndex;
    }

    public noteOff(pitch: number, expressionId: number): void {
        for (let i = 0; i < this.voices.length; i += 1) {
            const voice = this.voices[i];
            if (voice.state === VoiceState.IDLE) {
                continue;
            }
            if (this.voicePitch[i] !== pitch) {
                continue;
            }
            if (expressionId >= 0 && this.voiceExpression[i] !== expressionId) {
                continue;
            }
            voice.noteOff();
        }
    }

    public allNotesOff(): void {
        for (let i = 0; i < this.voices.length; i += 1) {
            if (this.voices[i].state !== VoiceState.IDLE) {
                this.voices[i].noteOff();
            }
        }
    }

    public setParameter(paramId: number, value: number): void {
        this.parameters.set(paramId, value);
        for (let i = 0; i < this.voices.length; i += 1) {
            this.voices[i].setParameter(paramId, value);
        }
    }

    public getParameter(paramId: number): number {
        return this.parameters.get(paramId) ?? 0;
    }

    public render(blockSize: number): AudioBuffer {
        if (this.output === null || this.output.blockSize !== blockSize) {
            this.output = createAudioBuffer(1, blockSize);
        }

        const out = this.output;
        out.data.fill(0);

        for (let i = 0; i < this.voices.length; i += 1) {
            const voice = this.voices[i];
            if (voice.state === VoiceState.IDLE) {
                continue;
            }

            const voiceOut = voice.render(blockSize);
            const src = voiceOut.data;
            const dst = out.data;
            for (let sampleIndex = 0; sampleIndex < blockSize; sampleIndex += 1) {
                dst[sampleIndex] += src[sampleIndex];
            }

            if (this.voices[i].state === VoiceState.IDLE) {
                this.voicePitch[i] = -1;
                this.voiceExpression[i] = -1;
                this.noteAges[i] = 0;
            }
        }

        return out;
    }

    public getActiveVoiceCount(): number {
        let count = 0;
        for (let i = 0; i < this.voices.length; i += 1) {
            if (this.voices[i].state !== VoiceState.IDLE) {
                count += 1;
            }
        }
        return count;
    }

    public reset(): void {
        for (let i = 0; i < this.voices.length; i += 1) {
            this.voices[i].reset();
            this.noteAges[i] = 0;
            this.voicePitch[i] = -1;
            this.voiceExpression[i] = -1;
        }
        this.parameters.clear();
        this.noteCounter = 1;
        if (this.output !== null) {
            this.output.data.fill(0);
        }
    }

    private findIdleVoice(): number {
        for (let i = 0; i < this.voices.length; i += 1) {
            if (this.voices[i].state === VoiceState.IDLE) {
                return i;
            }
        }
        return -1;
    }

    private computeRms(buffer: AudioBuffer): number {
        const data = buffer.data;
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) {
            const s = data[i];
            sum += s * s;
        }
        return data.length > 0 ? Math.sqrt(sum / data.length) : 0;
    }

    private selectVoiceToSteal(): number {
        if (this.stealPolicy === StealPolicy.QUIETEST) {
            let quietestIndex = -1;
            let lowestRms = Infinity;
            let countAtLowest = 0;

            for (let i = 0; i < this.voices.length; i += 1) {
                const voice = this.voices[i];
                if (voice.state === VoiceState.IDLE) {
                    continue;
                }
                const buf = voice.context.descriptorBuffers[voice.outputBufferIndex];
                const rms = this.computeRms(buf);
                if (rms < lowestRms) {
                    lowestRms = rms;
                    quietestIndex = i;
                    countAtLowest = 1;
                } else if (rms === lowestRms) {
                    countAtLowest += 1;
                }
            }

            if (quietestIndex >= 0 && countAtLowest === 1 && lowestRms > 0) {
                return quietestIndex;
            }
        }

        // QUIETEST falls back to OLDEST when all voices have equal or zero RMS —
        // zero RMS means all voices are silent or the buffer hasn't been rendered yet,
        // and in that case age is the most stable tiebreaker.
        let oldestIndex = 0;
        let oldestAge = this.noteAges[0];
        for (let i = 1; i < this.noteAges.length; i += 1) {
            const age = this.noteAges[i];
            if (age < oldestAge) {
                oldestAge = age;
                oldestIndex = i;
            }
        }
        return oldestIndex;
    }
}
