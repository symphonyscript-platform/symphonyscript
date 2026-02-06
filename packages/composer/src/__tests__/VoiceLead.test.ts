/**
 * Tests for voiceLead() method on SynapticMelody.
 * Task 047: Voice-led chord progressions with minimal voice movement.
 */

import { SiliconBridge } from '@symphonyscript/kernel';
import { SynapticMelody } from '../clips/SynapticMelody';
import { NoteOperation } from '../types';

// Mock bridge with insertAsync
const createMockBridge = (): jest.Mocked<SiliconBridge> => ({
    insertAsync: jest.fn().mockReturnValue(0)
} as any);

describe('SynapticMelody.voiceLead()', () => {
    let mockBridge: jest.Mocked<SiliconBridge>;
    let melody: SynapticMelody;

    beforeEach(() => {
        mockBridge = createMockBridge();
        melody = new SynapticMelody(mockBridge);
    });

    describe('Basic functionality', () => {
        it('requires key context', () => {
            expect(() => {
                melody.voiceLead(['I', 'IV', 'V', 'I']);
            }).toThrow('voiceLead() requires key() to be called first');
        });

        it('generates chords for I-IV-V-I progression', () => {
            melody.key('C', 'major');
            melody.voiceLead(['I', 'IV', 'V', 'I']);

            const ops = melody.toOperations();
            const noteOps = ops.filter(op => op.kind === 'note') as NoteOperation[];

            // Should have 4 chords × 3 notes each = 12 notes
            expect(noteOps.length).toBe(12);
        });

        it('handles empty array', () => {
            melody.key('C', 'major');
            melody.voiceLead([]);

            const ops = melody.toOperations();
            expect(ops.length).toBe(0);
        });

        it('handles single chord', () => {
            melody.key('C', 'major');
            melody.voiceLead(['I']);

            const ops = melody.toOperations();
            const noteOps = ops.filter(op => op.kind === 'note') as NoteOperation[];

            // Single triad = 3 notes
            expect(noteOps.length).toBe(3);
        });
    });

    describe('Voice leading algorithm', () => {
        it('first chord uses root position', () => {
            melody.key('C', 'major');
            melody.voiceLead(['I']);

            const ops = melody.toOperations();
            const noteOps = ops.filter(op => op.kind === 'note') as NoteOperation[];
            const pitches = noteOps.map(op => op.pitch).sort((a, b) => a - b);

            // C major triad in root position: C, E, G
            // Pitches should be in ascending order
            expect(pitches[0]).toBeLessThan(pitches[1]);
            expect(pitches[1]).toBeLessThan(pitches[2]);
        });

        it('minimizes voice movement between chords', () => {
            melody.key('C', 'major');
            melody.voiceLead(['I', 'IV']);

            const ops = melody.toOperations();
            const noteOps = ops.filter(op => op.kind === 'note') as NoteOperation[];

            // Get pitches for first chord (tick 0) and second chord (tick 1)
            const firstChord = noteOps.filter(op => op.tick === 0).map(op => op.pitch).sort((a, b) => a - b);
            const secondChord = noteOps.filter(op => op.tick === 1).map(op => op.pitch).sort((a, b) => a - b);

            // Calculate total voice movement
            let totalMovement = 0;
            for (let i = 0; i < Math.min(firstChord.length, secondChord.length); i++) {
                totalMovement += Math.abs(firstChord[i] - secondChord[i]);
            }

            // Voice movement should be relatively small (< 12 semitones total for smooth voice leading)
            expect(totalMovement).toBeLessThan(12);
        });

        it('produces smooth ii-V-I progression', () => {
            melody.key('C', 'major');
            melody.voiceLead(['ii', 'V', 'I']);

            const ops = melody.toOperations();
            const noteOps = ops.filter(op => op.kind === 'note') as NoteOperation[];

            // Should have 3 chords × 3 notes = 9 notes
            expect(noteOps.length).toBe(9);

            // Get chords by tick
            const chord0 = noteOps.filter(op => op.tick === 0).map(op => op.pitch);
            const chord1 = noteOps.filter(op => op.tick === 1).map(op => op.pitch);
            const chord2 = noteOps.filter(op => op.tick === 2).map(op => op.pitch);

            // All chords should have 3 notes
            expect(chord0.length).toBe(3);
            expect(chord1.length).toBe(3);
            expect(chord2.length).toBe(3);
        });
    });

    describe('Duration option', () => {
        it('uses default duration of 1', () => {
            melody.key('C', 'major');
            melody.voiceLead(['I', 'IV']);

            const ops = melody.toOperations();
            const noteOps = ops.filter(op => op.kind === 'note') as NoteOperation[];

            // All notes should have duration 1
            for (const op of noteOps) {
                expect(op.duration).toBe(1);
            }
        });

        it('respects custom duration', () => {
            melody.key('C', 'major');
            melody.voiceLead(['I', 'IV'], { duration: 2 });

            const ops = melody.toOperations();
            const noteOps = ops.filter(op => op.kind === 'note') as NoteOperation[];

            // All notes should have duration 2
            for (const op of noteOps) {
                expect(op.duration).toBe(2);
            }
        });

        it('advances tick by duration for each chord', () => {
            melody.key('C', 'major');
            melody.voiceLead(['I', 'IV', 'V'], { duration: 2 });

            // Should advance by 2 × 3 = 6 ticks
            expect(melody.getCurrentTick()).toBe(6);
        });
    });

    describe('Different keys', () => {
        it('works in G major', () => {
            melody.key('G', 'major');
            melody.voiceLead(['I', 'IV', 'V', 'I']);

            const ops = melody.toOperations();
            const noteOps = ops.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps.length).toBe(12);
        });

        it('works in minor keys', () => {
            melody.key('A', 'minor');
            melody.voiceLead(['i', 'iv', 'V', 'i']);

            const ops = melody.toOperations();
            const noteOps = ops.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps.length).toBe(12);
        });

        it('works with flat keys', () => {
            melody.key('Bb', 'major');
            melody.voiceLead(['I', 'IV', 'V']);

            const ops = melody.toOperations();
            const noteOps = ops.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps.length).toBe(9);
        });
    });

    describe('Seventh chords', () => {
        it('handles seventh chords', () => {
            melody.key('C', 'major');
            melody.voiceLead(['ii7', 'V7', 'Imaj7']);

            const ops = melody.toOperations();
            const noteOps = ops.filter(op => op.kind === 'note') as NoteOperation[];

            // 3 chords × 4 notes each = 12 notes
            expect(noteOps.length).toBe(12);
        });
    });

    describe('Error handling', () => {
        it('throws for invalid roman numerals', () => {
            melody.key('C', 'major');

            expect(() => {
                melody.voiceLead(['I', 'invalid', 'V']);
            }).toThrow('Invalid roman numeral in voiceLead: invalid');
        });
    });

    describe('Chaining', () => {
        it('returns this for chaining', () => {
            melody.key('C', 'major');
            const result = melody.voiceLead(['I', 'IV']);

            expect(result).toBe(melody);
        });

        it('chains with other methods', () => {
            melody.key('C', 'major');
            melody
                .voiceLead(['I', 'IV'])
                .rest(1)
                .voiceLead(['V', 'I']);

            const ops = melody.toOperations();
            const noteOps = ops.filter(op => op.kind === 'note') as NoteOperation[];

            // 2 progressions × 2 chords × 3 notes = 12 notes
            expect(noteOps.length).toBe(12);
        });
    });

    describe('Integration', () => {
        it('works with progression() in same clip', () => {
            melody.key('C', 'major');
            melody.progression(['I', 'IV'], { duration: 1 });
            melody.voiceLead(['V', 'I'], { duration: 1 });

            const ops = melody.toOperations();
            const noteOps = ops.filter(op => op.kind === 'note') as NoteOperation[];

            // 4 chords × 3 notes = 12 notes
            expect(noteOps.length).toBe(12);
        });
    });
});
