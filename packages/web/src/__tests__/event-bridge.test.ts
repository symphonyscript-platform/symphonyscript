import type { Engine } from '@symphonyscript/dsp';
import {
    midiToUnitVelocity,
    routeCC,
    routeNoteEvent,
    routeNoteOff,
} from '../runtime/event-bridge';

type EngineRoutingSurface = Pick<
    Engine,
    'noteOn' | 'noteOff' | 'controlChange'
>;

function createEngineMock(): jest.Mocked<EngineRoutingSurface> {
    return {
        noteOn: jest.fn(),
        noteOff: jest.fn(),
        controlChange: jest.fn(),
    };
}

describe('event bridge', () => {
    test('midiToUnitVelocity normalizes and clamps values', () => {
        expect(midiToUnitVelocity(0)).toBe(0);
        expect(midiToUnitVelocity(64)).toBeCloseTo(64 / 127, 8);
        expect(midiToUnitVelocity(127)).toBe(1);
        expect(midiToUnitVelocity(-3)).toBe(0);
        expect(midiToUnitVelocity(500)).toBe(1);
    });

    test('routeNoteEvent forwards to engine.noteOn with normalized velocity', () => {
        const engine = createEngineMock();

        routeNoteEvent(engine as unknown as Engine, 2, 69, 100, 16, 11);

        expect(engine.noteOn).toHaveBeenCalledTimes(1);
        expect(engine.noteOn).toHaveBeenCalledWith(
            2,
            69,
            100 / 127,
            16,
            11
        );
    });

    test('routeNoteOff forwards to engine.noteOff', () => {
        const engine = createEngineMock();

        routeNoteOff(engine as unknown as Engine, 3, 74, 8);

        expect(engine.noteOff).toHaveBeenCalledTimes(1);
        expect(engine.noteOff).toHaveBeenCalledWith(3, 74, 8);
    });

    test('routeCC forwards to engine.controlChange', () => {
        const engine = createEngineMock();

        routeCC(engine as unknown as Engine, 1, 74, 0.5);

        expect(engine.controlChange).toHaveBeenCalledTimes(1);
        expect(engine.controlChange).toHaveBeenCalledWith(1, 74, 0.5);
    });
});
