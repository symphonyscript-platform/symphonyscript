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
} from '@symphonyscript/dsp';
import type { BasicInstrument as BasicInstrumentType, GraphDefinition } from '@symphonyscript/dsp';
import type { SubtractiveSynthOptions } from './factory-types';

const OSC_ID = 1;
const ENV_ID = 2;
const AMP_ID = 3;

const DEFAULT_NAME = 'Subtractive Synth';
const DEFAULT_MAX_VOICES = 8;
const DEFAULT_SAMPLE_RATE = 48000;
const DEFAULT_BLOCK_SIZE = 64;
const DEFAULT_ATTACK_SEC = 0.005;
const DEFAULT_DECAY_SEC = 0.1;
const DEFAULT_SUSTAIN_LEVEL = 0.8;
const DEFAULT_RELEASE_SEC = 0.2;
const DEFAULT_GAIN = 0.2;

const SUBTRACTIVE_GRAPH: GraphDefinition = {
    modules: [
        { id: OSC_ID, type: ModuleType.OSCILLATOR, initialParameters: [] },
        { id: ENV_ID, type: ModuleType.ENVELOPE, initialParameters: [] },
        { id: AMP_ID, type: ModuleType.AMPLIFIER, initialParameters: [] },
    ],
    wires: [
        { sourceModuleId: OSC_ID, sourcePortId: 0, targetModuleId: AMP_ID, targetPortId: 0 },
        { sourceModuleId: ENV_ID, sourcePortId: 0, targetModuleId: AMP_ID, targetPortId: 1 },
    ],
    outputPortModuleId: AMP_ID,
    outputPortId: 0,
};

export function createSubtractiveInstrument(
    options: SubtractiveSynthOptions = {}
): BasicInstrumentType {
    const name = options.name ?? DEFAULT_NAME;
    const maxVoices = options.maxVoices ?? DEFAULT_MAX_VOICES;
    const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
    const blockSize = options.blockSize ?? DEFAULT_BLOCK_SIZE;
    const stealPolicy = options.stealPolicy ?? StealPolicy.OLDEST;
    const waveform = options.waveform ?? OscillatorWaveform.SAW;
    const attackSec = options.attackSec ?? DEFAULT_ATTACK_SEC;
    const decaySec = options.decaySec ?? DEFAULT_DECAY_SEC;
    const sustainLevel = options.sustainLevel ?? DEFAULT_SUSTAIN_LEVEL;
    const releaseSec = options.releaseSec ?? DEFAULT_RELEASE_SEC;
    const gain = options.gain ?? DEFAULT_GAIN;

    const compiledPlan = compileGraph(SUBTRACTIVE_GRAPH, blockSize);

    const voiceFactory = (): BasicVoice => {
        const osc = new OscillatorModule(OSC_ID, sampleRate);
        osc.setParameter(OscillatorParam.WAVEFORM, waveform);

        const env = new EnvelopeModule(ENV_ID, sampleRate);
        env.setParameter(EnvelopeParam.ATTACK_SEC, attackSec);
        env.setParameter(EnvelopeParam.DECAY_SEC, decaySec);
        env.setParameter(EnvelopeParam.SUSTAIN_LEVEL, sustainLevel);
        env.setParameter(EnvelopeParam.RELEASE_SEC, releaseSec);

        const amp = new AmplifierModule(AMP_ID);
        amp.setParameter(AmplifierParam.GAIN, gain);

        return new BasicVoice(compiledPlan, [osc, env, amp]);
    };

    return new BasicInstrument(name, maxVoices, stealPolicy, voiceFactory);
}
