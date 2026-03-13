import {
    AmplifierModule,
    AmplifierParam,
    BasicInstrument,
    BasicVoice,
    compileGraph,
    EnvelopeModule,
    EnvelopeParam,
    ModuleType,
    OscillatorModule,
    OscillatorParam,
    OscillatorWaveform,
    StealPolicy,
    VoiceState,
} from '@symphonyscript/dsp';
import type {
    BasicInstrument as BasicInstrumentType,
    CompiledPlan,
    DSPModule,
    GraphDefinition,
} from '@symphonyscript/dsp';
import type { FMSynthOptions } from './factory-types';

export interface FMVoiceOptions {
    compiledPlan: CompiledPlan;
    modules: DSPModule[];
    modId: number;
    carrierId: number;
    modulatorRatio: number;
    modulationIndex: number;
    envelopeParams: {
        attackSec: number;
        decaySec: number;
        sustainLevel: number;
        releaseSec: number;
    };
    gain: number;
}

const MOD_ID = 1;
const CARRIER_ID = 2;
const ENV_ID = 3;
const AMP_ID = 4;

const DEFAULT_NAME = 'FM Synth';
const DEFAULT_MAX_VOICES = 8;
const DEFAULT_SAMPLE_RATE = 48000;
const DEFAULT_BLOCK_SIZE = 64;
const DEFAULT_ATTACK_SEC = 0.005;
const DEFAULT_DECAY_SEC = 0.1;
const DEFAULT_SUSTAIN_LEVEL = 0.8;
const DEFAULT_RELEASE_SEC = 0.2;
const DEFAULT_GAIN = 0.2;
const DEFAULT_MODULATION_INDEX = 2;
const DEFAULT_MODULATOR_RATIO = 2;

const FM_GRAPH: GraphDefinition = {
    modules: [
        { id: MOD_ID, type: ModuleType.OSCILLATOR, initialParameters: [] },
        { id: CARRIER_ID, type: ModuleType.OSCILLATOR, initialParameters: [] },
        { id: ENV_ID, type: ModuleType.ENVELOPE, initialParameters: [] },
        { id: AMP_ID, type: ModuleType.AMPLIFIER, initialParameters: [] },
    ],
    wires: [
        { sourceModuleId: MOD_ID, sourcePortId: 0, targetModuleId: CARRIER_ID, targetPortId: 0 },
        { sourceModuleId: CARRIER_ID, sourcePortId: 0, targetModuleId: AMP_ID, targetPortId: 0 },
        { sourceModuleId: ENV_ID, sourcePortId: 0, targetModuleId: AMP_ID, targetPortId: 1 },
    ],
    outputPortModuleId: AMP_ID,
    outputPortId: 0,
};

class FMVoice extends BasicVoice {
    private readonly modId: number;
    private readonly carrierId: number;
    private readonly modulatorRatio: number;

    public constructor(opts: FMVoiceOptions) {
        super(opts.compiledPlan, opts.modules);

        this.modId = opts.modId;
        this.carrierId = opts.carrierId;
        this.modulatorRatio = opts.modulatorRatio;
    }

    public override noteOn(frequency: number, velocity: number, gateOffset: number): void {
        this.frequency = frequency;
        this.velocity = velocity;
        this.gateOffset = gateOffset;
        this.state = VoiceState.ACTIVE;

        const modFreq = frequency * this.modulatorRatio;

        for (let i = 0; i < this.modules.length; i += 1) {
            const module = this.modules[i];
            if (module.type === ModuleType.OSCILLATOR) {
                if (module.id === this.modId) {
                    module.setParameter(OscillatorParam.FREQUENCY, modFreq);
                } else if (module.id === this.carrierId) {
                    module.setParameter(OscillatorParam.FREQUENCY, frequency);
                }
            } else if (module.type === ModuleType.ENVELOPE) {
                module.setParameter(EnvelopeParam.GATE, 1);
            }
        }
    }
}

export function createFMSynth(options: FMSynthOptions = {}): BasicInstrumentType {
    const name = options.name ?? DEFAULT_NAME;
    const maxVoices = options.maxVoices ?? DEFAULT_MAX_VOICES;
    const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
    const blockSize = options.blockSize ?? DEFAULT_BLOCK_SIZE;
    const stealPolicy = options.stealPolicy ?? StealPolicy.OLDEST;
    const modulationIndex = options.modulationIndex ?? DEFAULT_MODULATION_INDEX;
    const modulatorRatio = options.modulatorRatio ?? DEFAULT_MODULATOR_RATIO;
    const attackSec = options.attackSec ?? DEFAULT_ATTACK_SEC;
    const decaySec = options.decaySec ?? DEFAULT_DECAY_SEC;
    const sustainLevel = options.sustainLevel ?? DEFAULT_SUSTAIN_LEVEL;
    const releaseSec = options.releaseSec ?? DEFAULT_RELEASE_SEC;
    const gain = options.gain ?? DEFAULT_GAIN;

    const compiledPlan = compileGraph(FM_GRAPH, blockSize);

    const voiceFactory = (): BasicVoice => {
        const mod = new OscillatorModule(MOD_ID, sampleRate);
        mod.setParameter(OscillatorParam.WAVEFORM, OscillatorWaveform.SINE);

        const carrier = new OscillatorModule(CARRIER_ID, sampleRate);
        carrier.setParameter(OscillatorParam.WAVEFORM, OscillatorWaveform.SINE);
        carrier.setParameter(OscillatorParam.MODULATION_INDEX, modulationIndex);
        carrier.setParameter(OscillatorParam.MODULATOR_RATIO, modulatorRatio);

        const env = new EnvelopeModule(ENV_ID, sampleRate);
        env.setParameter(EnvelopeParam.ATTACK_SEC, attackSec);
        env.setParameter(EnvelopeParam.DECAY_SEC, decaySec);
        env.setParameter(EnvelopeParam.SUSTAIN_LEVEL, sustainLevel);
        env.setParameter(EnvelopeParam.RELEASE_SEC, releaseSec);

        const amp = new AmplifierModule(AMP_ID);
        amp.setParameter(AmplifierParam.GAIN, gain);

        return new FMVoice({
            compiledPlan,
            modules: [mod, carrier, env, amp],
            modId: MOD_ID,
            carrierId: CARRIER_ID,
            modulatorRatio,
            modulationIndex,
            envelopeParams: { attackSec, decaySec, sustainLevel, releaseSec },
            gain,
        });
    };

    return new BasicInstrument(name, maxVoices, stealPolicy, voiceFactory);
}
