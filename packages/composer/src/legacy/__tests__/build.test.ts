import { SynapticMelody } from '../clips/SynapticMelody'
import { SCHEMA_VERSION } from '../types'
import { createTestBridge } from '../test-bridge'

describe('SynapticClip.build()', () => {
    let melody: SynapticMelody;
    let mockBridge: ReturnType<typeof createTestBridge>;

    beforeEach(() => {
        mockBridge = createTestBridge();
        melody = new SynapticMelody(mockBridge);
    });

    it('returns ClipNode with correct structure', () => {
        melody.name('TestClip').tempo(140).timeSignature(3, 4);

        const result = melody.build();

        expect(result._version).toBe(SCHEMA_VERSION);
        expect(result.kind).toBe('clip');
        expect(result.name).toBe('TestClip');
        expect(result.tempo).toBe(140);
        expect(result.timeSignature).toEqual([3, 4]);
        expect(result.operations).toEqual([]);
    });

    it('records operations when notes are flushed', () => {
        melody.name('NoteClip');
        melody.note('C4', 0.5).commit();
        melody.note('E4', 0.25).commit();

        const result = melody.build();

        expect(result.operations.length).toBe(2);
        expect(result.operations[0].kind).toBe('note');
        expect(result.operations[0].pitch).toBe(60); // C4
        expect(result.operations[0].duration).toBe(0.5);
        expect(result.operations[1].pitch).toBe(64); // E4
        expect(result.operations[1].duration).toBe(0.25);
    });

    it('includes swing and groove settings', () => {
        melody.swing(0.7).groove('jazz');

        const result = melody.build();

        expect(result.swing).toBe(0.7);
        expect(result.groove).toBe('jazz');
    });

    it('returns empty operations for empty clip', () => {
        const result = melody.build();

        expect(result.operations).toEqual([]);
        expect(result.name).toBe('');
    });
});
