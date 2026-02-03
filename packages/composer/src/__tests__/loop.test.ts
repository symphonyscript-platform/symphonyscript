import { SynapticMelody } from '../clips/SynapticMelody';
import { SiliconBridge } from '@symphonyscript/kernel';

describe('SynapticMelody.loop()', () => {
    let melody: SynapticMelody;
    let mockBridge: jest.Mocked<SiliconBridge>;

    beforeEach(() => {
        mockBridge = {
            insertAsync: jest.fn().mockReturnValue(0)
        } as any;
        melody = new SynapticMelody(mockBridge);
    });

    it('executes builder function count times', () => {
        let callCount = 0;

        melody.loop(3, () => {
            callCount++;
        });

        expect(callCount).toBe(3);
    });

    it('records operations for each iteration', () => {
        melody.loop(2, (clip) => {
            clip.note('C4', 0.25).commit();
        });

        const result = melody.build();

        expect(result.operations.length).toBe(2);
        expect(result.operations[0].pitch).toBe(60);
        expect(result.operations[1].pitch).toBe(60);
    });

    it('advances tick across iterations with sequential notes', () => {
        // When using sequential note() calls, tick advances between notes
        // not after commit(). Each note() commits the previous pending note.
        melody.loop(3, (clip) => {
            clip.note('C4', 0.5);  // Creates pending note, commits previous
        });
        // Final note needs explicit commit
        melody.note('D4', 0.25).commit();  // Triggers commit of last loop note + D4

        const result = melody.build();

        // 3 C4 notes from loop + 1 D4 = 4 operations
        expect(result.operations.length).toBe(4);
        expect(result.operations[0].tick).toBe(0);      // First C4
        expect(result.operations[1].tick).toBe(0.5);    // Second C4
        expect(result.operations[2].tick).toBe(1.0);    // Third C4
        expect(result.operations[3].tick).toBe(1.5);    // D4
    });

    it('returns this for chaining', () => {
        const result = melody.loop(1, () => {});

        expect(result).toBe(melody);
    });

    it('handles zero count', () => {
        let called = false;

        melody.loop(0, () => {
            called = true;
        });

        expect(called).toBe(false);
        expect(melody.build().operations.length).toBe(0);
    });
});
