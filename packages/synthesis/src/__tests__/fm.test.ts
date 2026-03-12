import { createFMSynth } from '../fm';

describe('createFMSynth', () => {
    test('throws explicit not implemented yet error', () => {
        expect(() => createFMSynth()).toThrow(/not implemented yet/i);
    });
});
