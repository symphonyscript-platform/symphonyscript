import { SynapticMelody } from '../clips/SynapticMelody';
import { SiliconBridge } from '@symphonyscript/kernel';
import { ClipNode, SCHEMA_VERSION } from '../types';

describe('SynapticMelody.play()', () => {
    let melody: SynapticMelody;
    let mockBridge: jest.Mocked<SiliconBridge>;

    beforeEach(() => {
        mockBridge = {
            insertAsync: jest.fn().mockReturnValue(0)
        } as any;
        melody = new SynapticMelody(mockBridge);
    });

    it('inserts operations from another SynapticMelody', () => {
        // Create source clip
        const source = new SynapticMelody(mockBridge);
        source.note('C4', 0.5).commit();
        source.note('E4', 0.25).commit();

        // Play source into melody
        melody.play(source);

        const result = melody.build();
        expect(result.operations.length).toBe(2);
        expect(result.operations[0].pitch).toBe(60); // C4
        expect(result.operations[1].pitch).toBe(64); // E4
    });

    it('inserts operations from a ClipNode', () => {
        const sourceClip: ClipNode = {
            _version: SCHEMA_VERSION,
            kind: 'clip',
            name: 'Source',
            operations: [
                { kind: 'note', pitch: 60, velocity: 100, duration: 0.5, tick: 0, muted: false, sourceId: 1 },
                { kind: 'note', pitch: 64, velocity: 100, duration: 0.25, tick: 0.5, muted: false, sourceId: 2 }
            ]
        };

        melody.play(sourceClip);

        const result = melody.build();
        expect(result.operations.length).toBe(2);
        expect(result.operations[0].pitch).toBe(60);
        expect(result.operations[1].pitch).toBe(64);
    });

    it('offsets operations by current tick position', () => {
        // Advance melody tick to 1.0 using rest()
        melody.rest(1.0);

        const source = new SynapticMelody(mockBridge);
        source.note('C4', 0.5).commit();

        melody.play(source);

        const result = melody.build();
        // C4 from source should be at tick 1.0 (offset by melody's current tick)
        const playedOp = result.operations.find(op => op.kind === 'note' && op.pitch === 60);
        expect(playedOp?.tick).toBe(1.0);
    });

    it('advances tick by source clip duration', () => {
        const source = new SynapticMelody(mockBridge);
        source.note('C4', 0.5);  // Pending
        source.note('E4', 0.25).commit();  // Commits C4, makes E4 pending, then commits E4

        melody.play(source);

        // Source operations: C4 at tick 0 dur 0.5, E4 at tick 0.5 dur 0.25
        // Max: max(0 + 0.5, 0.5 + 0.25) = 0.75
        expect(melody.getCurrentTick()).toBe(0.75);
    });

    it('returns this for chaining', () => {
        const source = new SynapticMelody(mockBridge);
        const result = melody.play(source);

        expect(result).toBe(melody);
    });

    it('handles empty source clip', () => {
        const source = new SynapticMelody(mockBridge);

        melody.play(source);

        expect(melody.build().operations.length).toBe(0);
        expect(melody.getCurrentTick()).toBe(0);
    });

    it('generates new sourceIds for inserted operations', () => {
        const sourceClip: ClipNode = {
            _version: SCHEMA_VERSION,
            kind: 'clip',
            name: 'Source',
            operations: [
                { kind: 'note', pitch: 60, velocity: 100, duration: 0.5, tick: 0, muted: false, sourceId: 999 }
            ]
        };

        melody.play(sourceClip);

        const result = melody.build();
        expect(result.operations[0].sourceId).not.toBe(999);
    });
});
