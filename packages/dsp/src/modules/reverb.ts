import { ModuleType, PortRate } from '../constants';
import type { AudioBuffer, DSPModule, PortDescriptor } from '../types';

const REVERB_INPUTS: readonly PortDescriptor[] = [
    {
        id: 0,
        rate: PortRate.AUDIO,
        channelCount: 1,
        name: 'in',
    },
];

const REVERB_OUTPUTS: readonly PortDescriptor[] = [
    {
        id: 0,
        rate: PortRate.AUDIO,
        channelCount: 1,
        name: 'out',
    },
];

/** Comb delay times at 48 kHz (samples). */
const COMB_DELAYS_48K = [1557, 1617, 1491, 1422] as const;
/** Allpass delay times at 48 kHz (samples). */
const ALLPASS_DELAYS_48K = [225, 341] as const;
/** Allpass feedback coefficient (typical Schroeder value). */
const ALLPASS_G = 0.5;

export const ReverbParam = {
    ROOM_SIZE: 0,
    DAMPING: 1,
    MIX: 2,
} as const;

export type ReverbParam = (typeof ReverbParam)[keyof typeof ReverbParam];

function clampFloat(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
        return min;
    }
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function scaleDelay(samples48k: number, sampleRate: number): number {
    const scaled = (samples48k * sampleRate) / 48000;
    return Math.max(1, Math.round(scaled));
}

export class ReverbModule implements DSPModule {
    public readonly type = ModuleType.EFFECT;
    public readonly id: number;
    public readonly inputs = REVERB_INPUTS;
    public readonly outputs = REVERB_OUTPUTS;

    private readonly combBuffers: readonly Float32Array[];
    private readonly combDelays: readonly number[];
    private readonly combWriteHeads: number[];
    private readonly combLpState: number[];

    private readonly allpassBuffers: readonly Float32Array[];
    private readonly allpassDelays: readonly number[];
    private readonly allpassWriteHeads: number[];

    private roomSize = 0.5;
    private damping = 0.5;
    private mix = 0.3;

    constructor(id: number, sampleRate: number) {
        this.id = id;

        const combDelays: number[] = [];
        const combBuffers: Float32Array[] = [];
        for (let i = 0; i < COMB_DELAYS_48K.length; i += 1) {
            const d = scaleDelay(COMB_DELAYS_48K[i], sampleRate);
            combDelays.push(d);
            combBuffers.push(new Float32Array(d));
        }
        this.combDelays = combDelays;
        this.combBuffers = combBuffers;
        this.combWriteHeads = [0, 0, 0, 0];
        this.combLpState = [0, 0, 0, 0];

        const allpassDelays: number[] = [];
        const allpassBuffers: Float32Array[] = [];
        for (let i = 0; i < ALLPASS_DELAYS_48K.length; i += 1) {
            const d = scaleDelay(ALLPASS_DELAYS_48K[i], sampleRate);
            allpassDelays.push(d);
            allpassBuffers.push(new Float32Array(d));
        }
        this.allpassDelays = allpassDelays;
        this.allpassBuffers = allpassBuffers;
        this.allpassWriteHeads = [0, 0];
    }

    public process(
        inputBuffers: readonly AudioBuffer[],
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

        const outputData = output.data;
        const audioInput = inputBuffers[0];
        if (!audioInput || audioInput.data.length < blockSize) {
            outputData.fill(0, 0, blockSize);
            return;
        }

        const inputData = audioInput.data;

        const feedback =
            0.7 + this.roomSize * 0.28;
        const damp = this.damping;
        const mixVal = this.mix;
        const dryGain = 1 - mixVal;

        const combBuf0 = this.combBuffers[0];
        const combBuf1 = this.combBuffers[1];
        const combBuf2 = this.combBuffers[2];
        const combBuf3 = this.combBuffers[3];
        const combDel0 = this.combDelays[0];
        const combDel1 = this.combDelays[1];
        const combDel2 = this.combDelays[2];
        const combDel3 = this.combDelays[3];
        const combMax0 = combBuf0.length;
        const combMax1 = combBuf1.length;
        const combMax2 = combBuf2.length;
        const combMax3 = combBuf3.length;

        const apBuf0 = this.allpassBuffers[0];
        const apBuf1 = this.allpassBuffers[1];
        const apDel0 = this.allpassDelays[0];
        const apDel1 = this.allpassDelays[1];
        const apMax0 = apBuf0.length;
        const apMax1 = apBuf1.length;

        let wh0 = this.combWriteHeads[0];
        let wh1 = this.combWriteHeads[1];
        let wh2 = this.combWriteHeads[2];
        let wh3 = this.combWriteHeads[3];
        let lp0 = this.combLpState[0];
        let lp1 = this.combLpState[1];
        let lp2 = this.combLpState[2];
        let lp3 = this.combLpState[3];
        let apWh0 = this.allpassWriteHeads[0];
        let apWh1 = this.allpassWriteHeads[1];

        for (let i = 0; i < blockSize; i += 1) {
            const dry = inputData[i];

            const r0 =
                (wh0 - combDel0 + combMax0) % combMax0;
            const r1 =
                (wh1 - combDel1 + combMax1) % combMax1;
            const r2 =
                (wh2 - combDel2 + combMax2) % combMax2;
            const r3 =
                (wh3 - combDel3 + combMax3) % combMax3;

            const d0 = combBuf0[r0];
            const d1 = combBuf1[r1];
            const d2 = combBuf2[r2];
            const d3 = combBuf3[r3];

            lp0 = damp * lp0 + (1 - damp) * d0;
            lp1 = damp * lp1 + (1 - damp) * d1;
            lp2 = damp * lp2 + (1 - damp) * d2;
            lp3 = damp * lp3 + (1 - damp) * d3;

            combBuf0[wh0] = dry + feedback * lp0;
            combBuf1[wh1] = dry + feedback * lp1;
            combBuf2[wh2] = dry + feedback * lp2;
            combBuf3[wh3] = dry + feedback * lp3;

            wh0 = (wh0 + 1) % combMax0;
            wh1 = (wh1 + 1) % combMax1;
            wh2 = (wh2 + 1) % combMax2;
            wh3 = (wh3 + 1) % combMax3;

            const combSum = (d0 + d1 + d2 + d3) * 0.25;

            const apR0 = (apWh0 - apDel0 + apMax0) % apMax0;
            const apD0 = apBuf0[apR0];
            const apOut0 = -ALLPASS_G * combSum + apD0;
            apBuf0[apWh0] = combSum + ALLPASS_G * apOut0;
            apWh0 = (apWh0 + 1) % apMax0;

            const apR1 = (apWh1 - apDel1 + apMax1) % apMax1;
            const apD1 = apBuf1[apR1];
            const apOut1 = -ALLPASS_G * apOut0 + apD1;
            apBuf1[apWh1] = apOut0 + ALLPASS_G * apOut1;
            apWh1 = (apWh1 + 1) % apMax1;

            outputData[i] = dry * dryGain + apOut1 * mixVal;
        }

        this.combWriteHeads[0] = wh0;
        this.combWriteHeads[1] = wh1;
        this.combWriteHeads[2] = wh2;
        this.combWriteHeads[3] = wh3;
        this.combLpState[0] = lp0;
        this.combLpState[1] = lp1;
        this.combLpState[2] = lp2;
        this.combLpState[3] = lp3;
        this.allpassWriteHeads[0] = apWh0;
        this.allpassWriteHeads[1] = apWh1;
    }

    public setParameter(paramId: number, value: number): void {
        if (paramId === ReverbParam.ROOM_SIZE) {
            this.roomSize = clampFloat(value, 0, 1);
        } else if (paramId === ReverbParam.DAMPING) {
            this.damping = clampFloat(value, 0, 1);
        } else if (paramId === ReverbParam.MIX) {
            this.mix = clampFloat(value, 0, 1);
        }
    }

    public getParameter(paramId: number): number {
        if (paramId === ReverbParam.ROOM_SIZE) {
            return this.roomSize;
        }
        if (paramId === ReverbParam.DAMPING) {
            return this.damping;
        }
        if (paramId === ReverbParam.MIX) {
            return this.mix;
        }
        return 0;
    }

    public reset(): void {
        for (let i = 0; i < this.combBuffers.length; i += 1) {
            this.combBuffers[i].fill(0);
            this.combWriteHeads[i] = 0;
            this.combLpState[i] = 0;
        }
        for (let i = 0; i < this.allpassBuffers.length; i += 1) {
            this.allpassBuffers[i].fill(0);
            this.allpassWriteHeads[i] = 0;
        }
    }
}
