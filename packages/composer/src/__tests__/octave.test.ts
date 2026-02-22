import { SynapticMelody } from '../clips/SynapticMelody';
import { createTestBridge } from '../test-bridge';

describe('Octave methods', () => {
    let melody: SynapticMelody;
    let mockBridge: ReturnType<typeof createTestBridge>;

    beforeEach(() => {
        mockBridge = createTestBridge();
        melody = new SynapticMelody(mockBridge);
    });

    describe('octave()', () => {
        it('octave(5) sets transpose to +12', () => {
            melody.octave(5);
            melody.note('C4', 0.25).commit();

            const result = melody.build();
            // C4 = 60, +12 = 72 (C5)
            expect(result.operations[0].pitch).toBe(72);
        });

        it('octave(3) sets transpose to -12', () => {
            melody.octave(3);
            melody.note('C4', 0.25).commit();

            const result = melody.build();
            // C4 = 60, -12 = 48 (C3)
            expect(result.operations[0].pitch).toBe(48);
        });

        it('octave(4) is neutral (middle C)', () => {
            melody.octave(4);
            melody.note('C4', 0.25).commit();

            const result = melody.build();
            // C4 = 60, no offset
            expect(result.operations[0].pitch).toBe(60);
        });
    });

    describe('octaveUp()', () => {
        it('octaveUp(1) adds +12 to transpose', () => {
            melody.octaveUp(1);
            melody.note('C4', 0.25).commit();

            const result = melody.build();
            expect(result.operations[0].pitch).toBe(72);
        });

        it('octaveUp(2) adds +24 to transpose', () => {
            melody.octaveUp(2);
            melody.note('C4', 0.25).commit();

            const result = melody.build();
            expect(result.operations[0].pitch).toBe(84);
        });

        it('octaveUp() defaults to 1 octave', () => {
            melody.octaveUp();
            melody.note('C4', 0.25).commit();

            const result = melody.build();
            expect(result.operations[0].pitch).toBe(72);
        });

        it('octaveUp stacks with existing transpose', () => {
            melody.transpose(2); // +2 semitones
            melody.octaveUp(1);  // +12 semitones
            melody.note('C4', 0.25).commit();

            const result = melody.build();
            // 60 + 2 + 12 = 74... but octaveUp adds to transposeOffset
            // transpose(2) sets offset to 2, octaveUp(1) adds 12 → offset = 14
            expect(result.operations[0].pitch).toBe(74);
        });
    });

    describe('octaveDown()', () => {
        it('octaveDown(1) adds -12 to transpose', () => {
            melody.octaveDown(1);
            melody.note('C4', 0.25).commit();

            const result = melody.build();
            expect(result.operations[0].pitch).toBe(48);
        });

        it('octaveDown(2) adds -24 to transpose', () => {
            melody.octaveDown(2);
            melody.note('C4', 0.25).commit();

            const result = melody.build();
            expect(result.operations[0].pitch).toBe(36);
        });

        it('octaveDown() defaults to 1 octave', () => {
            melody.octaveDown();
            melody.note('C4', 0.25).commit();

            const result = melody.build();
            expect(result.operations[0].pitch).toBe(48);
        });
    });

    describe('cursor escapes', () => {
        it('cursor.octave() commits and returns clip', () => {
            const result = melody.note('C4', 0.25).octave(5);

            expect(result).toBe(melody);
            // C4 was committed before octave change
            expect(melody.build().operations[0].pitch).toBe(60);
        });

        it('cursor.octaveUp() commits and returns clip', () => {
            const result = melody.note('C4', 0.25).octaveUp(1);

            expect(result).toBe(melody);
        });

        it('cursor.octaveDown() commits and returns clip', () => {
            const result = melody.note('C4', 0.25).octaveDown(1);

            expect(result).toBe(melody);
        });
    });
});
