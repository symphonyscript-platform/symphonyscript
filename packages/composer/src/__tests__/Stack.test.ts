/**
 * Tests for stack(builderFn) parallel execution on SynapticMelody.
 * Task 048: Execute builder function in parallel mode.
 */

import { SynapticMelody } from '../clips/SynapticMelody';
import { NoteOperation, ScaleMode } from '../types';
import { createTestBridge } from '../test-bridge';

describe('SynapticMelody.stack(builderFn)', () => {
    let mockBridge: ReturnType<typeof createTestBridge>;
    let melody: SynapticMelody;

    beforeEach(() => {
        mockBridge = createTestBridge();
        melody = new SynapticMelody(mockBridge);
    });

    describe('Basic functionality', () => {
        it('executes builder function notes at current tick', () => {
            melody.note('C4', 1).commit();
            melody.advanceTick(1);

            // Stack should place notes at tick 1
            melody.stack(b => {
                b.note('E4', 1).commit();
                b.note('G4', 1).commit();
            });

            const ops = melody.toOperations();
            const noteOps = ops.filter(op => op.kind === 'note') as NoteOperation[];

            // C4 at tick 0, E4 and G4 at tick 1
            expect(noteOps.length).toBe(3);

            const c4 = noteOps.find(op => op.pitch === 60);
            const e4 = noteOps.find(op => op.pitch === 64);
            const g4 = noteOps.find(op => op.pitch === 67);

            expect(c4?.tick).toBe(0);
            expect(e4?.tick).toBe(1);
            expect(g4?.tick).toBe(1);
        });

        it('does NOT advance parent tick after stacked content', () => {
            melody.stack(b => {
                b.note('C4', 1).commit();
                b.advanceTick(1);
                b.note('E4', 1).commit();
                b.advanceTick(1);
            });

            // Tick should still be at 0 (not advanced by stacked content)
            expect(melody.getCurrentTick()).toBe(0);
        });

        it('places stacked notes at saved tick position', () => {
            melody.advanceTick(4);

            melody.stack(b => {
                b.note('C4', 1).commit();
            });

            const ops = melody.toOperations();
            const noteOps = ops.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps[0].tick).toBe(4);
        });
    });

    describe('Multiple stacked layers', () => {
        it('can stack multiple layers at same tick', () => {
            melody.stack(b => {
                b.note('C4', 1).commit();
            });

            melody.stack(b => {
                b.note('E4', 1).commit();
            });

            melody.stack(b => {
                b.note('G4', 1).commit();
            });

            const ops = melody.toOperations();
            const noteOps = ops.filter(op => op.kind === 'note') as NoteOperation[];

            // All three notes at tick 0
            expect(noteOps.length).toBe(3);
            expect(noteOps.every(op => op.tick === 0)).toBe(true);
        });

        it('stacked layers are independent', () => {
            melody.stack(b => {
                b.note('C4', 1).commit();
                b.advanceTick(1);
                b.note('D4', 1).commit();
            });

            melody.stack(b => {
                b.note('E4', 2).commit();
            });

            const ops = melody.toOperations();
            const noteOps = ops.filter(op => op.kind === 'note') as NoteOperation[];

            // C4 at 0, D4 at 1, E4 at 0
            expect(noteOps.length).toBe(3);

            const c4 = noteOps.find(op => op.pitch === 60);
            const d4 = noteOps.find(op => op.pitch === 62);
            const e4 = noteOps.find(op => op.pitch === 64);

            expect(c4?.tick).toBe(0);
            expect(d4?.tick).toBe(1);
            expect(e4?.tick).toBe(0);
        });
    });

    describe('No-arg stack() still works', () => {
        it('enables polyphonic stacking mode', () => {
            const result = melody.stack();
            expect(result).toBe(melody);
        });
    });

    describe('Builder function return handling', () => {
        it('handles builder returning void', () => {
            melody.stack(b => {
                b.note('C4', 1).commit();
            });

            const ops = melody.toOperations();
            expect(ops.length).toBe(1);
        });

        it('handles builder returning this', () => {
            melody.stack(b => {
                return b.note('C4', 1).commit() as SynapticMelody;
            });

            const ops = melody.toOperations();
            expect(ops.length).toBe(1);
        });

        it('handles builder returning cursor (auto-commits)', () => {
            melody.stack(b => {
                return b.note('C4', 1); // Returns cursor, not committed
            });

            const ops = melody.toOperations();
            // Should auto-commit the cursor
            expect(ops.length).toBe(1);
        });
    });

    describe('Chaining', () => {
        it('returns this for chaining', () => {
            const result = melody.stack(b => {
                b.note('C4', 1).commit();
            });

            expect(result).toBe(melody);
        });

        it('chains with other methods', () => {
            melody
                .stack(b => {
                    b.note('C4', 1).commit();
                })
                .advanceTick(1);

            melody.note('E4', 1).commit();

            const ops = melody.toOperations();
            const noteOps = ops.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps.length).toBe(2);

            const c4 = noteOps.find(op => op.pitch === 60);
            const e4 = noteOps.find(op => op.pitch === 64);

            expect(c4?.tick).toBe(0);
            expect(e4?.tick).toBe(1);
        });
    });

    describe('Integration', () => {
        it('works with chords in stacked layers', () => {
            melody.key('C', ScaleMode.MAJOR);

            melody.stack(b => {
                b.chord('C').duration(2).commit();
            });

            melody.stack(b => {
                b.chord('Am').duration(2).commit();
            });

            const ops = melody.toOperations();
            const noteOps = ops.filter(op => op.kind === 'note') as NoteOperation[];

            // Both chords at tick 0
            expect(noteOps.every(op => op.tick === 0)).toBe(true);
        });

        it('works with progression after stack', () => {
            melody.key('C', ScaleMode.MAJOR);

            melody.stack(b => {
                b.note('C4', 4).commit();
            });

            melody.advanceTick(4);
            melody.progression(['I', 'IV'], 2);

            const ops = melody.toOperations();
            const noteOps = ops.filter(op => op.kind === 'note') as NoteOperation[];

            // 1 stacked note + 2 chords × 3 notes = 7 notes
            expect(noteOps.length).toBe(7);
        });

        it('creates parallel melodies', () => {
            // Two parallel melodies
            melody.stack(b => {
                b.note('C4', 1).commit();
                b.advanceTick(1);
                b.note('E4', 1).commit();
                b.advanceTick(1);
                b.note('G4', 1).commit();
            });

            melody.stack(b => {
                b.note('G3', 1).commit();
                b.advanceTick(1);
                b.note('C4', 1).commit();
                b.advanceTick(1);
                b.note('E4', 1).commit();
            });

            const ops = melody.toOperations();
            const noteOps = ops.filter(op => op.kind === 'note') as NoteOperation[];

            // 6 notes total
            expect(noteOps.length).toBe(6);

            // Tick should still be 0
            expect(melody.getCurrentTick()).toBe(0);
        });
    });
});
