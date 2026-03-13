import {
    AmplifierModule,
    AmplifierParam,
    BasicInstrument,
    BasicVoice,
    compileGraph,
    EnvelopeModule,
    EnvelopeParam,
    FilterModule,
    FilterParam,
    FilterType,
    ModuleType,
    OscillatorModule,
    OscillatorParam,
    OscillatorWaveform,
    StealPolicy,
} from '@symphonyscript/dsp';
import type { BasicInstrument as BasicInstrumentType, GraphDefinition } from '@symphonyscript/dsp';
import type { SubtractiveSynthOptions } from './factory-types';

const OSC_ID = 1;
const ENV_FLT_ID = 2;
const ENV_AMP_ID = 3;
const FILTER_ID = 4;
const AMP_ID = 5;

const DEFAULT_NAME = 'Subtractive Synth';
const DEFAULT_MAX_VOICES = 8;
const DEFAULT_SAMPLE_RATE = 48000;
const DEFAULT_BLOCK_SIZE = 64;
const DEFAULT_ATTACK_SEC = 0.005;
const DEFAULT_DECAY_SEC = 0.1;
const DEFAULT_SUSTAIN_LEVEL = 0.8;
const DEFAULT_RELEASE_SEC = 0.2;
const DEFAULT_GAIN = 0.2;
const DEFAULT_FILTER_CUTOFF = 2000;
const DEFAULT_FILTER_RESONANCE = 0;
const DEFAULT_FILTER_ATTACK_SEC = 0.01;
const DEFAULT_FILTER_DECAY_SEC = 0.2;
const DEFAULT_FILTER_SUSTAIN_LEVEL = 0.6;
const DEFAULT_FILTER_RELEASE_SEC = 0.15;

const SUBTRACTIVE_GRAPH: GraphDefinition = {
    modules: [
        { id: OSC_ID, type: ModuleType.OSCILLATOR, initialParameters: [] },
        { id: ENV_FLT_ID, type: ModuleType.ENVELOPE, initialParameters: [] },
        { id: ENV_AMP_ID, type: ModuleType.ENVELOPE, initialParameters: [] },
        { id: FILTER_ID, type: ModuleType.FILTER, initialParameters: [] },
        { id: AMP_ID, type: ModuleType.AMPLIFIER, initialParameters: [] },
    ],
    wires: [
        { sourceModuleId: OSC_ID, sourcePortId: 0, targetModuleId: FILTER_ID, targetPortId: 0 },
        { sourceModuleId: ENV_FLT_ID, sourcePortId: 0, targetModuleId: FILTER_ID, targetPortId: 1 },
        { sourceModuleId: FILTER_ID, sourcePortId: 0, targetModuleId: AMP_ID, targetPortId: 0 },
        { sourceModuleId: ENV_AMP_ID, sourcePortId: 0, targetModuleId: AMP_ID, targetPortId: 1 },
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
    const filterCutoff = options.filterCutoff ?? DEFAULT_FILTER_CUTOFF;
    const filterResonance = options.filterResonance ?? DEFAULT_FILTER_RESONANCE;
    const filterType = options.filterType ?? FilterType.LOWPASS;
    const filterAttackSec = options.filterAttackSec ?? DEFAULT_FILTER_ATTACK_SEC;
    const filterDecaySec = options.filterDecaySec ?? DEFAULT_FILTER_DECAY_SEC;
    const filterSustainLevel = options.filterSustainLevel ?? DEFAULT_FILTER_SUSTAIN_LEVEL;
    const filterReleaseSec = options.filterReleaseSec ?? DEFAULT_FILTER_RELEASE_SEC;

    const compiledPlan = compileGraph(SUBTRACTIVE_GRAPH, blockSize);

    const voiceFactory = (): BasicVoice => {
        const osc = new OscillatorModule(OSC_ID, sampleRate);
        osc.setParameter(OscillatorParam.WAVEFORM, waveform);

        const envFlt = new EnvelopeModule(ENV_FLT_ID, sampleRate);
        envFlt.setParameter(EnvelopeParam.ATTACK_SEC, filterAttackSec);
        envFlt.setParameter(EnvelopeParam.DECAY_SEC, filterDecaySec);
        envFlt.setParameter(EnvelopeParam.SUSTAIN_LEVEL, filterSustainLevel);
        envFlt.setParameter(EnvelopeParam.RELEASE_SEC, filterReleaseSec);

        const envAmp = new EnvelopeModule(ENV_AMP_ID, sampleRate);
        envAmp.setParameter(EnvelopeParam.ATTACK_SEC, attackSec);
        envAmp.setParameter(EnvelopeParam.DECAY_SEC, decaySec);
        envAmp.setParameter(EnvelopeParam.SUSTAIN_LEVEL, sustainLevel);
        envAmp.setParameter(EnvelopeParam.RELEASE_SEC, releaseSec);

        const filter = new FilterModule(FILTER_ID, sampleRate);
        filter.setParameter(FilterParam.CUTOFF, filterCutoff);
        filter.setParameter(FilterParam.RESONANCE, filterResonance);
        filter.setParameter(FilterParam.FILTER_TYPE, filterType);

        const amp = new AmplifierModule(AMP_ID);
        amp.setParameter(AmplifierParam.GAIN, gain);

        return new BasicVoice(compiledPlan, [osc, envFlt, envAmp, filter, amp]);
    };

    return new BasicInstrument(name, maxVoices, stealPolicy, voiceFactory);
}
