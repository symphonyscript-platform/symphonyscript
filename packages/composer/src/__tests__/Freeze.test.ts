import { SynapticMelody } from '../clips/SynapticMelody';
import { FrozenClip } from '../clips/FrozenClip';
import { Clip } from '../Clip';
import { NoteOperation } from '../types';
import { createTestBridge } from '../test-bridge';

describe('Freeze (Task 038)', () => {
    let mockBridge: ReturnType<typeof createTestBridge>;

    beforeEach(() => {
        mockBridge = createTestBridge();
    });

    describe('FrozenClip class', () => {
        it('stores clipNode', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note('C4', 0.5).commit();
            const frozen = melody.freeze();

            expect(frozen.clipNode).toBeDefined();
            expect(frozen.clipNode.operations).toHaveLength(1);
        });

        it('stores options', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note('C4', 0.5).commit();
            const frozen = melody.freeze({ bpm: 90 });

            expect(frozen.options.bpm).toBe(90);
        });

        it('duration getter returns total clip duration', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note('C4', 1).commit();
            melody.advanceTick(1);
            melody.note('D4', 0.5).commit();
            const frozen = melody.freeze();

            expect(frozen.duration).toBe(1.5); // tick 1 + duration 0.5
        });

        it('duration returns 0 for empty clip', () => {
            const melody = new SynapticMelody(mockBridge);
            const frozen = melody.freeze();

            expect(frozen.duration).toBe(0);
        });

        it('noteCount getter returns number of notes', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note('C4', 0.5).commit();
            melody.advanceTick(0.5);
            melody.note('D4', 0.5).commit();
            melody.advanceTick(0.5);
            melody.note('E4', 0.5).commit();
            const frozen = melody.freeze();

            expect(frozen.noteCount).toBe(3);
        });
    });

    describe('SynapticClip.freeze()', () => {
        it('returns FrozenClip instance', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note('C4', 0.5).commit();
            const frozen = melody.freeze();

            expect(frozen).toBeInstanceOf(FrozenClip);
        });

        it('uses clip tempo as default bpm', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.tempo(140);
            melody.note('C4', 0.5).commit();
            const frozen = melody.freeze();

            expect(frozen.options.bpm).toBe(140);
        });

        it('uses clip time signature as default', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.timeSignature(3, 4);
            melody.note('C4', 0.5).commit();
            const frozen = melody.freeze();

            expect(frozen.options.timeSignature).toEqual([3, 4]);
        });

        it('allows custom bpm override', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.tempo(140);
            melody.note('C4', 0.5).commit();
            const frozen = melody.freeze({ bpm: 100 });

            expect(frozen.options.bpm).toBe(100);
        });

        it('allows custom time signature override', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.timeSignature(4, 4);
            melody.note('C4', 0.5).commit();
            const frozen = melody.freeze({ timeSignature: [6, 8] });

            expect(frozen.options.timeSignature).toEqual([6, 8]);
        });

        it('captures all operations at freeze time', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note('C4', 0.5).commit();
            melody.advanceTick(0.5);
            melody.note('D4', 0.5).commit();
            const frozen = melody.freeze();

            // Add more notes after freeze
            melody.advanceTick(0.5);
            melody.note('E4', 0.5).commit();

            // Frozen clip should only have 2 notes
            expect(frozen.noteCount).toBe(2);
        });
    });

    describe('play(FrozenClip)', () => {
        it('inserts frozen clip operations at current tick', () => {
            const riffBridge = createTestBridge();
            const riff = new SynapticMelody(riffBridge);
            riff.note('C4', 0.5).commit();
            riff.advanceTick(0.5);
            riff.note('E4', 0.5).commit();
            const frozen = riff.freeze();

            const mainBridge = createTestBridge();
            const main = new SynapticMelody(mainBridge);
            main.advanceTick(2); // Start at tick 2
            main.play(frozen);

            const result = main.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps).toHaveLength(2);
            expect(noteOps[0].tick).toBe(2);     // C4 at tick 2
            expect(noteOps[1].tick).toBe(2.5);   // E4 at tick 2.5
        });

        it('advances tick by frozen clip duration', () => {
            const riffBridge = createTestBridge();
            const riff = new SynapticMelody(riffBridge);
            riff.note('C4', 1).commit();
            const frozen = riff.freeze();

            const mainBridge = createTestBridge();
            const main = new SynapticMelody(mainBridge);
            main.play(frozen);
            main.note('D4', 0.5).commit();

            const result = main.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps).toHaveLength(2);
            expect(noteOps[0].tick).toBe(0);   // C4 at tick 0
            expect(noteOps[1].tick).toBe(1);   // D4 at tick 1 (after frozen clip)
        });

        it('can play same frozen clip multiple times', () => {
            const riffBridge = createTestBridge();
            const riff = new SynapticMelody(riffBridge);
            riff.note('C4', 0.5).commit();
            const frozen = riff.freeze();

            const mainBridge = createTestBridge();
            const main = new SynapticMelody(mainBridge);
            main.play(frozen);
            main.play(frozen);
            main.play(frozen);

            const result = main.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps).toHaveLength(3);
            expect(noteOps[0].tick).toBe(0);
            expect(noteOps[1].tick).toBe(0.5);
            expect(noteOps[2].tick).toBe(1);
        });

        it('preserves note properties from frozen clip', () => {
            const riffBridge = createTestBridge();
            const riff = new SynapticMelody(riffBridge);
            riff.note('C4', 0.5).velocity(0.9).commit();
            const frozen = riff.freeze();

            const mainBridge = createTestBridge();
            const main = new SynapticMelody(mainBridge);
            main.play(frozen);

            const result = main.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps[0].pitch).toBe(60);
            expect(noteOps[0].duration).toBe(0.5);
            expect(noteOps[0].velocity).toBeGreaterThan(100);
        });

        it('assigns new sourceIds to played notes', () => {
            const riffBridge = createTestBridge();
            const riff = new SynapticMelody(riffBridge);
            riff.note('C4', 0.5).commit();
            const frozen = riff.freeze();

            const mainBridge = createTestBridge();
            const main = new SynapticMelody(mainBridge);
            main.play(frozen);
            main.play(frozen);

            const result = main.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // Each play should get unique sourceIds
            expect(noteOps[0].sourceId).not.toBe(noteOps[1].sourceId);
        });
    });

    describe('Clip factory integration', () => {
        it('Clip.melody().freeze() works', () => {
            const riff = Clip.melody('riff');
            riff.note('C4', 0.5).commit();
            const frozen = riff.freeze();

            expect(frozen).toBeInstanceOf(FrozenClip);
            expect(frozen.clipNode.name).toBe('riff');
        });

        it('Clip.melody().play(frozen) works', () => {
            const riffBridge = createTestBridge();
            const riff = new SynapticMelody(riffBridge);
            riff.note('C4', 0.5).commit();
            const frozen = riff.freeze();

            const mainBridge = createTestBridge();
            const main = new SynapticMelody(mainBridge);
            main.play(frozen);
            main.play(frozen);

            const result = main.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps).toHaveLength(2);
        });
    });

    describe('Edge cases', () => {
        it('empty frozen clip', () => {
            const melody = new SynapticMelody(mockBridge);
            const frozen = melody.freeze();

            const main = new SynapticMelody(mockBridge);
            main.play(frozen);

            const result = main.build();
            expect(result.operations).toHaveLength(0);
        });

        it('frozen clip with non-note operations', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.control(1, 64); // CC - no longer stored
            melody.note('C4', 0.5).commit();
            const frozen = melody.freeze();

            const mainBridge = createTestBridge();
            const main = new SynapticMelody(mainBridge);
            main.play(frozen);

            const result = main.build();
            const noteOps = result.operations.filter(op => op.kind === 'note');
            expect(noteOps).toHaveLength(1);
        });

        it('chaining after freeze', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note('C4', 0.5).commit();

            // freeze() doesn't return this, but we can still use the original
            const frozen = melody.freeze();
            melody.advanceTick(0.5);
            melody.note('D4', 0.5).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps).toHaveLength(2);
            expect(frozen.noteCount).toBe(1); // Frozen only has 1
        });
    });
});
