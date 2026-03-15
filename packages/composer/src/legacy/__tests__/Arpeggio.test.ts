import { SynapticMelody } from '../clips/SynapticMelody';
import { Clip } from '../Clip';
import { createTestBridge } from '../test-bridge';
import { NoteOperation, ArpPattern } from '../types';

describe('Arpeggio Generator', () => {
    let mockBridge: ReturnType<typeof createTestBridge>;
    let melody: SynapticMelody;

    beforeEach(() => {
        mockBridge = createTestBridge();
        melody = new SynapticMelody(mockBridge);
    });

    describe('basic functionality', () => {
        it('plays notes sequentially', () => {
            melody.arpeggiate(['C4', 'E4', 'G4'], 0.25);

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps).toHaveLength(3);
        });

        it('uses correct pitches', () => {
            melody.arpeggiate(['C4', 'E4', 'G4'], 0.25);

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps[0].pitch).toBe(60); // C4
            expect(noteOps[1].pitch).toBe(64); // E4
            expect(noteOps[2].pitch).toBe(67); // G4
        });

        it('advances tick by rate for each note', () => {
            melody.arpeggiate(['C4', 'E4', 'G4'], 0.25);

            // 3 notes * 0.25 = 0.75
            expect(melody.getCurrentTick()).toBe(0.75);
        });

        it('applies gate to note duration', () => {
            melody.arpeggiate(['C4', 'E4', 'G4'], 0.25, { gate: 0.5 });

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // duration = rate * gate = 0.25 * 0.5 = 0.125
            for (const op of noteOps) {
                expect(op.duration).toBe(0.125);
            }
        });

        it('applies default gate (0.8)', () => {
            melody.arpeggiate(['C4', 'E4', 'G4'], 0.25);

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // duration = rate * gate = 0.25 * 0.8 = 0.2
            for (const op of noteOps) {
                expect(op.duration).toBe(0.2);
            }
        });

        it('applies velocity', () => {
            melody.arpeggiate(['C4', 'E4', 'G4'], 0.25, { velocity: 0.5 });

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // velocity 0.5 * 127 ≈ 63
            for (const op of noteOps) {
                expect(op.velocity).toBeGreaterThan(55);
                expect(op.velocity).toBeLessThan(70);
            }
        });

        it('returns this for chaining', () => {
            const result = melody.arpeggiate(['C4', 'E4', 'G4'], 0.25);
            expect(result).toBe(melody);
        });
    });

    describe('pattern: up', () => {
        it('plays notes in ascending order', () => {
            melody.arpeggiate(['G4', 'C4', 'E4'], 0.25, { pattern: ArpPattern.UP });

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // Should be sorted ascending: C4, E4, G4
            expect(noteOps[0].pitch).toBe(60); // C4
            expect(noteOps[1].pitch).toBe(64); // E4
            expect(noteOps[2].pitch).toBe(67); // G4
        });
    });

    describe('pattern: down', () => {
        it('plays notes in descending order', () => {
            melody.arpeggiate(['C4', 'E4', 'G4'], 0.25, { pattern: ArpPattern.DOWN });

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // Should be sorted descending: G4, E4, C4
            expect(noteOps[0].pitch).toBe(67); // G4
            expect(noteOps[1].pitch).toBe(64); // E4
            expect(noteOps[2].pitch).toBe(60); // C4
        });
    });

    describe('pattern: upDown', () => {
        it('plays up then down (no duplicate at peak)', () => {
            melody.arpeggiate(['C4', 'E4', 'G4'], 0.25, { pattern: ArpPattern.UP_DOWN });

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // Should be: C4, E4, G4, E4, C4 (5 notes)
            expect(noteOps).toHaveLength(5);
            expect(noteOps[0].pitch).toBe(60); // C4
            expect(noteOps[1].pitch).toBe(64); // E4
            expect(noteOps[2].pitch).toBe(67); // G4
            expect(noteOps[3].pitch).toBe(64); // E4
            expect(noteOps[4].pitch).toBe(60); // C4
        });
    });

    describe('pattern: downUp', () => {
        it('plays down then up (no duplicate at bottom)', () => {
            melody.arpeggiate(['C4', 'E4', 'G4'], 0.25, { pattern: ArpPattern.DOWN_UP });

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // Should be: G4, E4, C4, E4, G4 (5 notes)
            expect(noteOps).toHaveLength(5);
            expect(noteOps[0].pitch).toBe(67); // G4
            expect(noteOps[1].pitch).toBe(64); // E4
            expect(noteOps[2].pitch).toBe(60); // C4
            expect(noteOps[3].pitch).toBe(64); // E4
            expect(noteOps[4].pitch).toBe(67); // G4
        });
    });

    describe('pattern: random', () => {
        it('produces same order with same seed', () => {
            const melody1 = new SynapticMelody(mockBridge);
            melody1.arpeggiate(['C4', 'E4', 'G4', 'B4'], 0.25, { pattern: ArpPattern.RANDOM, seed: 42 });

            const melody2 = new SynapticMelody(mockBridge);
            melody2.arpeggiate(['C4', 'E4', 'G4', 'B4'], 0.25, { pattern: ArpPattern.RANDOM, seed: 42 });

            const notes1 = melody1.build().operations.filter(op => op.kind === 'note').map(op => (op as NoteOperation).pitch);
            const notes2 = melody2.build().operations.filter(op => op.kind === 'note').map(op => (op as NoteOperation).pitch);

            expect(notes1).toEqual(notes2);
        });

        it('produces different order with different seed', () => {
            const bridge1 = createTestBridge();
            const melody1 = new SynapticMelody(bridge1);
            melody1.arpeggiate(['C4', 'E4', 'G4', 'B4'], 0.25, { pattern: ArpPattern.RANDOM, seed: 42 });

            const bridge2 = createTestBridge();
            const melody2 = new SynapticMelody(bridge2);
            melody2.arpeggiate(['C4', 'E4', 'G4', 'B4'], 0.25, { pattern: ArpPattern.RANDOM, seed: 123 });

            const notes1 = melody1.build().operations.filter(op => op.kind === 'note').map(op => (op as NoteOperation).pitch);
            const notes2 = melody2.build().operations.filter(op => op.kind === 'note').map(op => (op as NoteOperation).pitch);

            // Different seeds should produce different order (with high probability)
            expect(notes1).not.toEqual(notes2);
        });
    });

    describe('pattern: converge', () => {
        it('plays outer to inner (first, last, second, second-last, ...)', () => {
            melody.arpeggiate(['C4', 'E4', 'G4', 'B4'], 0.25, { pattern: ArpPattern.CONVERGE });

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // Should be: C4, B4, E4, G4
            expect(noteOps).toHaveLength(4);
            expect(noteOps[0].pitch).toBe(60); // C4 (first)
            expect(noteOps[1].pitch).toBe(71); // B4 (last)
            expect(noteOps[2].pitch).toBe(64); // E4 (second)
            expect(noteOps[3].pitch).toBe(67); // G4 (second-last)
        });
    });

    describe('pattern: diverge', () => {
        it('plays inner to outer (middle outward)', () => {
            melody.arpeggiate(['C4', 'E4', 'G4', 'B4'], 0.25, { pattern: ArpPattern.DIVERGE });

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // For 4 notes (even): starts with middle pair then expands
            // Middle indices are 1 and 2 (E4 and G4), then 0 and 3 (C4 and B4)
            expect(noteOps).toHaveLength(4);
        });

        it('handles odd number of notes', () => {
            melody.arpeggiate(['C4', 'E4', 'G4'], 0.25, { pattern: ArpPattern.DIVERGE });

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // For 3 notes: middle is E4, then G4 and C4
            expect(noteOps).toHaveLength(3);
            expect(noteOps[0].pitch).toBe(64); // E4 (middle)
        });
    });

    describe('multi-octave expansion', () => {
        it('expands pitches across 2 octaves', () => {
            melody.arpeggiate(['C4', 'E4', 'G4'], 0.25, { octaves: 2 });

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // Should have 6 notes: C4, E4, G4, C5, E5, G5
            expect(noteOps).toHaveLength(6);
            expect(noteOps[0].pitch).toBe(60); // C4
            expect(noteOps[1].pitch).toBe(64); // E4
            expect(noteOps[2].pitch).toBe(67); // G4
            expect(noteOps[3].pitch).toBe(72); // C5
            expect(noteOps[4].pitch).toBe(76); // E5
            expect(noteOps[5].pitch).toBe(79); // G5
        });

        it('expands pitches across 3 octaves', () => {
            melody.arpeggiate(['C4', 'E4'], 0.25, { octaves: 3 });

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // Should have 6 notes
            expect(noteOps).toHaveLength(6);
        });
    });

    describe('Clip factory integration', () => {
        it('Clip.melody().arpeggiate() works', () => {
            const result = Clip.melody('test')
                .arpeggiate(['C4', 'E4', 'G4'], 0.25, { pattern: ArpPattern.UP })
                .build();

            const noteOps = result.operations.filter(op => op.kind === 'note');
            expect(noteOps).toHaveLength(3);
        });
    });

    describe('edge cases', () => {
        it('handles single note', () => {
            melody.arpeggiate(['C4'], 0.25);

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].pitch).toBe(60);
        });

        it('handles numeric pitches', () => {
            melody.arpeggiate([60, 64, 67], 0.25);

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps[0].pitch).toBe(60);
            expect(noteOps[1].pitch).toBe(64);
            expect(noteOps[2].pitch).toBe(67);
        });

        it('handles mixed string and numeric pitches', () => {
            melody.arpeggiate(['C4', 64, 'G4'], 0.25);

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps[0].pitch).toBe(60);
            expect(noteOps[1].pitch).toBe(64);
            expect(noteOps[2].pitch).toBe(67);
        });
    });
});
