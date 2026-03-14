import { ModuleType, StealPolicy, VoiceState } from '../constants';
import { compileGraph } from '../graph-compiler';
import { EnvelopeModule, EnvelopeParam } from '../modules/envelope';
import { OscillatorModule, OscillatorParam, OscillatorWaveform } from '../modules/oscillator';
import { AmplifierModule, AmplifierParam } from '../modules/amplifier';
import { BasicVoice } from '../runtime/voice';
import { BasicInstrument } from '../runtime/instrument';
import type { GraphDefinition } from '../types';

const OSC_ID = 1;
const ENV_ID = 2;
const AMP_ID = 3;
const BLOCK_SIZE = 64;
const SAMPLE_RATE = 48000;

function createVoice(attackSec = 0, gain = 1): BasicVoice {
    const graph: GraphDefinition = {
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

    const compiledPlan = compileGraph(graph, BLOCK_SIZE);
    const osc = new OscillatorModule(OSC_ID, SAMPLE_RATE);
    osc.setParameter(OscillatorParam.WAVEFORM, OscillatorWaveform.SQUARE);
    const env = new EnvelopeModule(ENV_ID, SAMPLE_RATE);
    env.setParameter(EnvelopeParam.ATTACK_SEC, attackSec);
    env.setParameter(EnvelopeParam.DECAY_SEC, 0);
    env.setParameter(EnvelopeParam.SUSTAIN_LEVEL, 1);
    env.setParameter(EnvelopeParam.RELEASE_SEC, 0.001);
    const amp = new AmplifierModule(AMP_ID);
    amp.setParameter(AmplifierParam.GAIN, gain);

    return new BasicVoice(compiledPlan, [osc, env, amp]);
}

function hasNonZeroSamples(data: Float32Array): boolean {
    for (let i = 0; i < data.length; i += 1) {
        if (Math.abs(data[i]) > 0) {
            return true;
        }
    }
    return false;
}

function rms(data: Float32Array): number {
    let sumSquares = 0;
    for (let i = 0; i < data.length; i += 1) {
        const sample = data[i];
        sumSquares += sample * sample;
    }
    return Math.sqrt(sumSquares / data.length);
}

describe('runtime voice and instrument', () => {
    test('voice transitions ACTIVE on noteOn and RELEASE then IDLE after noteOff', () => {
        const voice = createVoice();

        voice.noteOn(440, 1, 0);
        expect(voice.state).toBe(VoiceState.ACTIVE);
        voice.render(BLOCK_SIZE);

        voice.noteOff();
        expect(voice.state).toBe(VoiceState.RELEASE);

        for (let i = 0; i < 16 && voice.state !== VoiceState.IDLE; i += 1) {
            voice.render(BLOCK_SIZE);
        }
        expect(voice.state).toBe(VoiceState.IDLE);
    });

    test('instrument noteOn allocates voices and returns valid indices', () => {
        const instrument = new BasicInstrument(
            'test',
            2,
            StealPolicy.OLDEST,
            () => createVoice()
        );

        const first = instrument.noteOn(60, 1, 0, 0);
        const second = instrument.noteOn(64, 1, 0, 1);

        expect(first).toBeGreaterThanOrEqual(0);
        expect(first).toBeLessThan(2);
        expect(second).toBeGreaterThanOrEqual(0);
        expect(second).toBeLessThan(2);
        expect(first).not.toBe(second);
    });

    test('instrument with NONE steal policy returns -1 when full', () => {
        const instrument = new BasicInstrument(
            'test',
            1,
            StealPolicy.NONE,
            () => createVoice()
        );

        const first = instrument.noteOn(60, 1, 0, 0);
        const second = instrument.noteOn(62, 1, 0, 0);

        expect(first).toBe(0);
        expect(second).toBe(-1);
    });

    test('render mixes multiple active voices into non-zero output', () => {
        const instrument = new BasicInstrument(
            'test',
            2,
            StealPolicy.OLDEST,
            () => createVoice()
        );

        instrument.noteOn(60, 1, 0, 0);
        instrument.noteOn(67, 1, 0, 1);

        const output = instrument.render(BLOCK_SIZE);
        expect(hasNonZeroSamples(output.data)).toBe(true);
    });

    test('allNotesOff releases active voices', () => {
        const instrument = new BasicInstrument(
            'test',
            2,
            StealPolicy.OLDEST,
            () => createVoice()
        );

        instrument.noteOn(60, 1, 0, 0);
        instrument.noteOn(67, 1, 0, 1);
        expect(instrument.getActiveVoiceCount()).toBe(2);

        instrument.allNotesOff();
        for (let i = 0; i < 16 && instrument.getActiveVoiceCount() > 0; i += 1) {
            instrument.render(BLOCK_SIZE);
        }

        expect(instrument.getActiveVoiceCount()).toBe(0);
    });

    test('QUIETEST steals the quieter voice when both active', () => {
        const instrument = new BasicInstrument(
            'test',
            2,
            StealPolicy.QUIETEST,
            (() => {
                const gains = [0.9, 0.1];
                let i = 0;
                return () => createVoice(0.001, gains[i++]);
            })()
        );

        instrument.noteOn(60, 1, 0, 0);
        instrument.noteOn(64, 1, 0, 1);

        for (let b = 0; b < 20; b += 1) {
            instrument.render(BLOCK_SIZE);
        }

        const stolenIndex = instrument.noteOn(68, 1, 0, 2);
        expect(stolenIndex).toBe(1);
    });

    test('stealing an active voice retriggers envelope attack', () => {
        const instrument = new BasicInstrument(
            'test',
            1,
            StealPolicy.OLDEST,
            () => createVoice(0.01)
        );

        instrument.noteOn(60, 1, 0, 0);
        let sustainBlock = instrument.render(BLOCK_SIZE);
        for (let i = 0; i < 16; i += 1) {
            sustainBlock = instrument.render(BLOCK_SIZE);
        }
        const sustainRms = rms(sustainBlock.data);
        expect(sustainRms).toBeGreaterThan(0.8);

        instrument.noteOn(67, 1, 0, 1);
        const retriggerBlock = instrument.render(BLOCK_SIZE);
        const retriggerRms = rms(retriggerBlock.data);

        expect(retriggerRms).toBeLessThan(0.2);
    });
});
