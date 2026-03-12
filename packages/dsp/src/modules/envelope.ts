import { ModuleType, PortRate } from '../constants';
import type { AudioBuffer, DSPModule, PortDescriptor } from '../types';

const DEFAULT_SAMPLE_RATE = 48000;

const EMPTY_INPUTS: readonly PortDescriptor[] = [];
const ENVELOPE_OUTPUTS: readonly PortDescriptor[] = [
    {
        id: 0,
        rate: PortRate.CONTROL,
        channelCount: 1,
        name: 'out',
    },
];

export const EnvelopeStage = {
    IDLE: 0,
    ATTACK: 1,
    DECAY: 2,
    SUSTAIN: 3,
    RELEASE: 4,
} as const;

export type EnvelopeStage = (typeof EnvelopeStage)[keyof typeof EnvelopeStage];

export const EnvelopeParam = {
    GATE: 0,
    ATTACK_SEC: 1,
    DECAY_SEC: 2,
    SUSTAIN_LEVEL: 3,
    RELEASE_SEC: 4,
} as const;

export type EnvelopeParam = (typeof EnvelopeParam)[keyof typeof EnvelopeParam];

function sanitizeTimeSeconds(value: number): number {
    if (!Number.isFinite(value) || value < 0) {
        return 0;
    }
    return value;
}

function sanitizeGate(value: number): number {
    if (!Number.isFinite(value) || value < 0.5) {
        return 0;
    }
    return 1;
}

function sanitizeSustainLevel(value: number): number {
    if (!Number.isFinite(value)) {
        return 0;
    }
    if (value <= 0) {
        return 0;
    }
    if (value >= 1) {
        return 1;
    }
    return value;
}

function sanitizeSampleRate(value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
        return DEFAULT_SAMPLE_RATE;
    }
    return value;
}

export class EnvelopeModule implements DSPModule {
    public readonly type = ModuleType.ENVELOPE;
    public readonly id: number;
    public readonly inputs = EMPTY_INPUTS;
    public readonly outputs = ENVELOPE_OUTPUTS;

    private sampleRate: number;
    private stage: EnvelopeStage = EnvelopeStage.IDLE;
    private level = 0;

    private gate = 0;
    private attackSec = 0.01;
    private decaySec = 0.1;
    private sustainLevel = 1;
    private releaseSec = 0.2;

    private attackIncrement = 0;
    private decayIncrement = 0;
    private releaseIncrement = 0;

    constructor(id: number, sampleRate = DEFAULT_SAMPLE_RATE) {
        this.id = id;
        this.sampleRate = sanitizeSampleRate(sampleRate);
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
        this.updateGateState();

        for (let i = 0; i < blockSize; i += 1) {
            this.advanceOneSample();
            data[i] = this.level;
        }
    }

    public setParameter(paramId: number, value: number): void {
        if (paramId === EnvelopeParam.GATE) {
            this.gate = sanitizeGate(value);
            return;
        }
        if (paramId === EnvelopeParam.ATTACK_SEC) {
            this.attackSec = sanitizeTimeSeconds(value);
            return;
        }
        if (paramId === EnvelopeParam.DECAY_SEC) {
            this.decaySec = sanitizeTimeSeconds(value);
            return;
        }
        if (paramId === EnvelopeParam.SUSTAIN_LEVEL) {
            this.sustainLevel = sanitizeSustainLevel(value);
            return;
        }
        if (paramId === EnvelopeParam.RELEASE_SEC) {
            this.releaseSec = sanitizeTimeSeconds(value);
        }
    }

    public getParameter(paramId: number): number {
        if (paramId === EnvelopeParam.GATE) {
            return this.gate;
        }
        if (paramId === EnvelopeParam.ATTACK_SEC) {
            return this.attackSec;
        }
        if (paramId === EnvelopeParam.DECAY_SEC) {
            return this.decaySec;
        }
        if (paramId === EnvelopeParam.SUSTAIN_LEVEL) {
            return this.sustainLevel;
        }
        if (paramId === EnvelopeParam.RELEASE_SEC) {
            return this.releaseSec;
        }
        return 0;
    }

    public reset(): void {
        this.stage = EnvelopeStage.IDLE;
        this.level = 0;
        this.gate = 0;
        this.attackIncrement = 0;
        this.decayIncrement = 0;
        this.releaseIncrement = 0;
    }

    private updateGateState(): void {
        if (
            this.gate >= 0.5 &&
            (this.stage === EnvelopeStage.IDLE || this.stage === EnvelopeStage.RELEASE)
        ) {
            this.enterAttack();
            return;
        }

        if (
            this.gate < 0.5 &&
            (this.stage === EnvelopeStage.ATTACK ||
                this.stage === EnvelopeStage.DECAY ||
                this.stage === EnvelopeStage.SUSTAIN)
        ) {
            this.enterRelease();
        }
    }

    private enterAttack(): void {
        this.stage = EnvelopeStage.ATTACK;
        if (this.attackSec <= 0) {
            this.attackIncrement = 0;
            return;
        }

        const samples = this.attackSec * this.sampleRate;
        if (samples <= 0) {
            this.attackIncrement = 0;
            return;
        }
        this.attackIncrement = (1 - this.level) / samples;
    }

    private enterDecay(): void {
        this.stage = EnvelopeStage.DECAY;
        const target = this.sustainLevel;
        if (this.decaySec <= 0 || this.level <= target) {
            this.decayIncrement = 0;
            return;
        }

        const samples = this.decaySec * this.sampleRate;
        if (samples <= 0) {
            this.decayIncrement = 0;
            return;
        }
        this.decayIncrement = (this.level - target) / samples;
    }

    private enterRelease(): void {
        this.stage = EnvelopeStage.RELEASE;
        if (this.releaseSec <= 0 || this.level <= 0) {
            this.releaseIncrement = 0;
            return;
        }

        const samples = this.releaseSec * this.sampleRate;
        if (samples <= 0) {
            this.releaseIncrement = 0;
            return;
        }
        this.releaseIncrement = this.level / samples;
    }

    private advanceOneSample(): void {
        let maxTransitions = 5;

        while (maxTransitions > 0) {
            maxTransitions -= 1;

            if (this.stage === EnvelopeStage.IDLE) {
                this.level = 0;
                break;
            }

            if (this.stage === EnvelopeStage.ATTACK) {
                if (this.attackSec <= 0) {
                    this.level = 1;
                    this.enterDecay();
                    continue;
                }

                this.level += this.attackIncrement;
                if (this.level >= 1) {
                    this.level = 1;
                    this.enterDecay();
                }
                break;
            }

            if (this.stage === EnvelopeStage.DECAY) {
                const target = this.sustainLevel;
                if (this.decaySec <= 0 || this.level <= target) {
                    this.level = target;
                    this.stage = EnvelopeStage.SUSTAIN;
                    continue;
                }

                this.level -= this.decayIncrement;
                if (this.level <= target) {
                    this.level = target;
                    this.stage = EnvelopeStage.SUSTAIN;
                }
                break;
            }

            if (this.stage === EnvelopeStage.SUSTAIN) {
                this.level = this.sustainLevel;
                break;
            }

            if (this.releaseSec <= 0) {
                this.level = 0;
                this.stage = EnvelopeStage.IDLE;
                continue;
            }

            this.level -= this.releaseIncrement;
            if (this.level <= 0) {
                this.level = 0;
                this.stage = EnvelopeStage.IDLE;
            }
            break;
        }
    }
}
