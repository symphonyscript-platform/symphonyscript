/**
 * Tests for OperationsSource interface and toOperations() method.
 * Task 046: Enable clips and frozen clips to provide operations.
 * Task 058: Uses createTestBridge (traverseNotes) for build/toOperations.
 */

import { SynapticMelody } from '../clips/SynapticMelody';
import { FrozenClip } from '../clips/FrozenClip';
import { OperationsSource, ClipOperation } from '../types';
import { createTestBridge } from '../test-bridge';

describe('OperationsSource Interface', () => {
    let mockBridge: ReturnType<typeof createTestBridge>;

    beforeEach(() => {
        mockBridge = createTestBridge();
    });

    describe('SynapticClip.toOperations()', () => {
        it('returns empty array for new clip', () => {
            const melody = new SynapticMelody(mockBridge);
            const ops = melody.toOperations();
            expect(ops).toEqual([]);
        });

        it('returns operations after adding notes', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note('C4', 1).commit();
            melody.note('E4', 1).commit();

            const ops = melody.toOperations();
            expect(ops.length).toBe(2);
            expect(ops[0].kind).toBe('note');
            expect(ops[1].kind).toBe('note');
        });

        it('returns snapshot (not affected by future changes)', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note('C4', 1).commit();

            const snapshot = melody.toOperations();
            expect(snapshot.length).toBe(1);

            // Add more notes
            melody.note('E4', 1).commit();
            melody.note('G4', 1).commit();

            // Snapshot should still have 1 operation
            expect(snapshot.length).toBe(1);

            // New call should have 3
            const newOps = melody.toOperations();
            expect(newOps.length).toBe(3);
        });

        it('includes note operations from Kernel', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note('C4', 1).commit();

            const ops = melody.toOperations();
            expect(ops.some(op => op.kind === 'note')).toBe(true);
        });
    });

    describe('FrozenClip.toOperations()', () => {
        it('returns frozen operations', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note('C4', 1).commit();
            melody.note('E4', 1).commit();

            const frozen = melody.freeze();
            const ops = frozen.toOperations();

            expect(ops.length).toBe(2);
            expect(ops[0].kind).toBe('note');
            expect(ops[1].kind).toBe('note');
        });

        it('returns shallow copy (safe to modify)', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note('C4', 1).commit();

            const frozen = melody.freeze();
            const ops1 = frozen.toOperations();
            const ops2 = frozen.toOperations();

            // Should be different array instances
            expect(ops1).not.toBe(ops2);
            expect(ops1).toEqual(ops2);
        });

        it('implements OperationsSource interface', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note('C4', 1).commit();

            const frozen = melody.freeze();

            // Type check - FrozenClip should be assignable to OperationsSource
            const source: OperationsSource = frozen;
            expect(typeof source.toOperations).toBe('function');
        });
    });

    describe('SynapticCursor.toOperations() escape', () => {
        it('commits pending note and returns operations', () => {
            const melody = new SynapticMelody(mockBridge);

            // Use cursor escape
            const ops = melody.note('C4', 1).toOperations();

            expect(ops.length).toBe(1);
            expect(ops[0].kind).toBe('note');
        });

        it('chains with modifiers before escape', () => {
            const melody = new SynapticMelody(mockBridge);

            const ops = melody.note('C4', 1).velocity(0.5).staccato().toOperations();

            expect(ops.length).toBe(1);
            if (ops[0].kind === 'note') {
                // Velocity is scaled and may have minor variations
                expect(ops[0].velocity).toBeGreaterThan(50);
                expect(ops[0].velocity).toBeLessThan(70);
            }
        });
    });

    describe('play() with OperationsSource', () => {
        it('accepts OperationsSource as argument', () => {
            const sourceBridge = createTestBridge();
            const source = new SynapticMelody(sourceBridge);
            source.note('C4', 1).commit();
            source.note('E4', 1).commit();

            const targetBridge = createTestBridge();
            const target = new SynapticMelody(targetBridge);
            target.play(source);

            const ops = target.toOperations();
            expect(ops.length).toBe(2);
        });

        it('accepts FrozenClip (implements OperationsSource)', () => {
            const sourceBridge = createTestBridge();
            const source = new SynapticMelody(sourceBridge);
            source.note('C4', 1).commit();
            const frozen = source.freeze();

            const targetBridge = createTestBridge();
            const target = new SynapticMelody(targetBridge);
            target.play(frozen);

            const ops = target.toOperations();
            expect(ops.length).toBe(1);
        });

        it('offsets operations by current tick', () => {
            const sourceBridge = createTestBridge();
            const source = new SynapticMelody(sourceBridge);
            source.note('C4', 1).commit();

            const targetBridge = createTestBridge();
            const target = new SynapticMelody(targetBridge);
            target.rest(4); // Advance to tick 4
            target.play(source);

            const ops = target.toOperations();
            expect(ops.length).toBe(1);
            if (ops[0].kind === 'note') {
                expect(ops[0].tick).toBe(4);
            }
        });
    });

    describe('loop() with OperationsSource', () => {
        it('accepts OperationsSource as second argument', () => {
            const sourceBridge = createTestBridge();
            const source = new SynapticMelody(sourceBridge);
            source.note('C4', 1).commit();

            const targetBridge = createTestBridge();
            const target = new SynapticMelody(targetBridge);
            target.loop(3, source);

            const ops = target.toOperations();
            expect(ops.length).toBe(3);
        });

        it('accepts FrozenClip in loop', () => {
            const sourceBridge = createTestBridge();
            const source = new SynapticMelody(sourceBridge);
            source.note('C4', 1).commit();
            const frozen = source.freeze();

            const targetBridge = createTestBridge();
            const target = new SynapticMelody(targetBridge);
            target.loop(2, frozen);

            const ops = target.toOperations();
            expect(ops.length).toBe(2);
        });

        it('still accepts builder function', () => {
            const target = new SynapticMelody(mockBridge);
            let callCount = 0;

            target.loop(3, (clip) => {
                clip.note('C4', 1).commit();
                clip.advanceTick(1);
                callCount++;
            });

            expect(callCount).toBe(3);
            const ops = target.toOperations();
            expect(ops.length).toBe(3);
        });

        it('offsets each loop iteration correctly', () => {
            const sourceBridge = createTestBridge();
            const source = new SynapticMelody(sourceBridge);
            source.note('C4', 1).commit();
            source.advanceTick(1);

            const targetBridge = createTestBridge();
            const target = new SynapticMelody(targetBridge);
            target.loop(3, source);

            const ops = target.toOperations();
            expect(ops.length).toBe(3);

            // Each note should be at tick 0, 1, 2
            const ticks = ops.filter(op => op.kind === 'note').map(op => (op as any).tick);
            expect(ticks).toEqual([0, 1, 2]);
        });
    });

    describe('Integration', () => {
        it('chains play and loop with OperationsSource', () => {
            const riffBridge = createTestBridge();
            const riff = new SynapticMelody(riffBridge);
            riff.note('C4', 0.5).commit();
            riff.advanceTick(0.5);
            riff.note('E4', 0.5).commit();
            riff.advanceTick(0.5);

            const songBridge = createTestBridge();
            const song = new SynapticMelody(songBridge);
            song.loop(2, riff);
            song.play(riff.freeze());

            const ops = song.toOperations();
            // 2 notes × 2 loops + 2 notes × 1 play = 6 notes
            expect(ops.length).toBe(6);
        });

        it('works with frozen clips in complex arrangements', () => {
            const verseBridge = createTestBridge();
            const verse = new SynapticMelody(verseBridge);
            verse.note('C4', 1).commit();
            verse.advanceTick(1);
            const frozenVerse = verse.freeze();

            const chorusBridge = createTestBridge();
            const chorus = new SynapticMelody(chorusBridge);
            chorus.note('G4', 1).commit();
            chorus.advanceTick(1);
            const frozenChorus = chorus.freeze();

            const songBridge = createTestBridge();
            const song = new SynapticMelody(songBridge);
            song.loop(2, frozenVerse);  // verse × 2
            song.play(frozenChorus);     // chorus × 1
            song.loop(2, frozenVerse);  // verse × 2

            const ops = song.toOperations();
            expect(ops.length).toBe(5); // 2 + 1 + 2
        });
    });
});
