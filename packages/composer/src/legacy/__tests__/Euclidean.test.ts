import { SynapticMelody } from '../clips/SynapticMelody'
import { SynapticDrums } from '../clips/SynapticDrums'
import { Clip } from '../Clip'
import { DrumType, NoteOperation } from '../types'
import { createTestBridge } from '../test-bridge'

describe('Euclidean Rhythm Generator', () => {
    let mockBridge: ReturnType<typeof createTestBridge>;

    beforeEach(() => {
        mockBridge = createTestBridge();
    });

    describe('SynapticMelody.euclidean()', () => {
        let melody: SynapticMelody;

        beforeEach(() => {
            melody = new SynapticMelody(mockBridge);
        });

        it('generates correct number of hits', () => {
            melody.euclidean({
                hits: 5,
                steps: 8,
                notes: ['C4', 'E4', 'G4'],
                stepDuration: 0.25
            });

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps).toHaveLength(5);
        });

        it('cycles through notes array', () => {
            melody.euclidean({
                hits: 5,
                steps: 8,
                notes: ['C4', 'E4', 'G4'],
                stepDuration: 0.25
            });

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // Notes should cycle: C4(60), E4(64), G4(67), C4(60), E4(64)
            expect(noteOps[0].pitch).toBe(60); // C4
            expect(noteOps[1].pitch).toBe(64); // E4
            expect(noteOps[2].pitch).toBe(67); // G4
            expect(noteOps[3].pitch).toBe(60); // C4 (wrapped)
            expect(noteOps[4].pitch).toBe(64); // E4 (wrapped)
        });

        it('uses correct step duration', () => {
            melody.euclidean({
                hits: 3,
                steps: 8,
                notes: ['C4'],
                stepDuration: 0.5
            });

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            for (const op of noteOps) {
                expect(op.duration).toBe(0.5);
            }
        });

        it('applies default velocity (0.8)', () => {
            melody.euclidean({
                hits: 3,
                steps: 8,
                notes: ['C4'],
                stepDuration: 0.25
            });

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // Velocity is scaled to 0-127, so 0.8 * 127 = ~101
            for (const op of noteOps) {
                expect(op.velocity).toBeGreaterThan(90);
                expect(op.velocity).toBeLessThan(110);
            }
        });

        it('applies custom velocity', () => {
            melody.euclidean({
                hits: 3,
                steps: 8,
                notes: ['C4'],
                stepDuration: 0.25,
                velocity: 0.5
            });

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // Velocity 0.5 * 127 = ~63
            for (const op of noteOps) {
                expect(op.velocity).toBeGreaterThan(55);
                expect(op.velocity).toBeLessThan(70);
            }
        });

        it('applies rotation', () => {
            // Without rotation: euclidean(3,8) = [1,0,0,1,0,0,1,0]
            // With rotation 1:  [0,1,0,0,1,0,0,1]
            const bridgeNoRot = createTestBridge();
            const melodyNoRotation = new SynapticMelody(bridgeNoRot);
            melodyNoRotation.euclidean({
                hits: 3,
                steps: 8,
                notes: ['C4'],
                stepDuration: 0.25,
                rotation: 0
            });

            const bridgeWithRot = createTestBridge();
            const melodyWithRotation = new SynapticMelody(bridgeWithRot);
            melodyWithRotation.euclidean({
                hits: 3,
                steps: 8,
                notes: ['C4'],
                stepDuration: 0.25,
                rotation: 1
            });

            const resultNoRot = melodyNoRotation.build();
            const resultWithRot = melodyWithRotation.build();

            const notesNoRot = resultNoRot.operations.filter(op => op.kind === 'note') as NoteOperation[];
            const notesWithRot = resultWithRot.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // Same number of hits
            expect(notesNoRot.length).toBe(notesWithRot.length);

            // But different tick positions (rotation shifts the pattern)
            const ticksNoRot = notesNoRot.map(n => n.tick);
            const ticksWithRot = notesWithRot.map(n => n.tick);
            expect(ticksNoRot).not.toEqual(ticksWithRot);
        });

        it('repeats pattern', () => {
            melody.euclidean({
                hits: 3,
                steps: 8,
                notes: ['C4'],
                stepDuration: 0.25,
                repeat: 2
            });

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // 3 hits * 2 repeats = 6 notes
            expect(noteOps).toHaveLength(6);
        });

        it('advances tick correctly', () => {
            melody.euclidean({
                hits: 3,
                steps: 8,
                notes: ['C4'],
                stepDuration: 0.25,
                repeat: 1
            });

            // 8 steps * 0.25 = 2.0 total duration
            expect(melody.getCurrentTick()).toBe(2.0);
        });

        it('returns this for chaining', () => {
            const result = melody.euclidean({
                hits: 3,
                steps: 8,
                notes: ['C4'],
                stepDuration: 0.25
            });

            expect(result).toBe(melody);
        });

        it('throws on invalid parameters', () => {
            expect(() => melody.euclidean({
                hits: 5,
                steps: 0, // Invalid
                notes: ['C4'],
                stepDuration: 0.25
            })).toThrow();
        });
    });

    describe('SynapticDrums.euclidean()', () => {
        let drums: SynapticDrums;

        beforeEach(() => {
            drums = new SynapticDrums(mockBridge);
        });

        it('generates correct number of hits', () => {
            drums.euclidean({
                hits: 4,
                steps: 16,
                drum: DrumType.KICK,
                stepDuration: 0.25
            });

            const result = drums.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps).toHaveLength(4);
        });

        it('uses kick drum', () => {
            drums.euclidean({
                hits: 4,
                steps: 16,
                drum: DrumType.KICK,
                stepDuration: 0.25
            });

            const result = drums.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // Kick is typically MIDI note 36 (C1)
            for (const op of noteOps) {
                expect(op.pitch).toBe(36);
            }
        });

        it('uses snare drum', () => {
            drums.euclidean({
                hits: 4,
                steps: 16,
                drum: DrumType.SNARE,
                stepDuration: 0.25
            });

            const result = drums.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // Snare is typically MIDI note 38 (D1)
            for (const op of noteOps) {
                expect(op.pitch).toBe(38);
            }
        });

        it('uses hat drum', () => {
            drums.euclidean({
                hits: 8,
                steps: 16,
                drum: DrumType.HAT,
                stepDuration: 0.25
            });

            const result = drums.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // Hat is typically MIDI note 42 (F#1)
            for (const op of noteOps) {
                expect(op.pitch).toBe(42);
            }
        });

        it('applies rotation', () => {
            const bridgeNoRot = createTestBridge();
            const drumsNoRotation = new SynapticDrums(bridgeNoRot);
            drumsNoRotation.euclidean({
                hits: 3,
                steps: 8,
                drum: DrumType.KICK,
                stepDuration: 0.25,
                rotation: 0
            });

            const bridgeWithRot = createTestBridge();
            const drumsWithRotation = new SynapticDrums(bridgeWithRot);
            drumsWithRotation.euclidean({
                hits: 3,
                steps: 8,
                drum: DrumType.KICK,
                stepDuration: 0.25,
                rotation: 2
            });

            const resultNoRot = drumsNoRotation.build();
            const resultWithRot = drumsWithRotation.build();

            const notesNoRot = resultNoRot.operations.filter(op => op.kind === 'note') as NoteOperation[];
            const notesWithRot = resultWithRot.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // Same number of hits
            expect(notesNoRot.length).toBe(notesWithRot.length);

            // But different tick positions
            const ticksNoRot = notesNoRot.map(n => n.tick);
            const ticksWithRot = notesWithRot.map(n => n.tick);
            expect(ticksNoRot).not.toEqual(ticksWithRot);
        });

        it('repeats pattern', () => {
            drums.euclidean({
                hits: 4,
                steps: 8,
                drum: DrumType.KICK,
                stepDuration: 0.25,
                repeat: 3
            });

            const result = drums.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            // 4 hits * 3 repeats = 12 notes
            expect(noteOps).toHaveLength(12);
        });

        it('advances tick correctly', () => {
            drums.euclidean({
                hits: 4,
                steps: 16,
                drum: DrumType.KICK,
                stepDuration: 0.125,
                repeat: 1
            });

            // 16 steps * 0.125 = 2.0 total duration
            expect(drums.getCurrentTick()).toBe(2.0);
        });

        it('returns this for chaining', () => {
            const result = drums.euclidean({
                hits: 4,
                steps: 16,
                drum: DrumType.KICK,
                stepDuration: 0.25
            });

            expect(result).toBe(drums);
        });
    });

    describe('Clip factory integration', () => {
        it('Clip.melody().euclidean() works', () => {
            const result = Clip.melody('test')
                .euclidean({
                    hits: 5,
                    steps: 8,
                    notes: ['C4', 'E4', 'G4'],
                    stepDuration: 0.25
                })
                .build();

            const noteOps = result.operations.filter(op => op.kind === 'note');
            expect(noteOps).toHaveLength(5);
        });

        it('Clip.drums().euclidean() works', () => {
            const result = Clip.drums('test')
                .euclidean({
                    hits: 4,
                    steps: 16,
                    drum: DrumType.KICK,
                    stepDuration: 0.25
                })
                .build();

            const noteOps = result.operations.filter(op => op.kind === 'note');
            expect(noteOps).toHaveLength(4);
        });
    });

    describe('Edge cases', () => {
        it('handles hits equal to steps (all hits)', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.euclidean({
                hits: 8,
                steps: 8,
                notes: ['C4'],
                stepDuration: 0.25
            });

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps).toHaveLength(8);
        });

        it('handles single hit', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.euclidean({
                hits: 1,
                steps: 8,
                notes: ['C4'],
                stepDuration: 0.25
            });

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps).toHaveLength(1);
        });

        it('handles numeric pitch in notes array', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.euclidean({
                hits: 3,
                steps: 8,
                notes: [60, 64, 67], // C4, E4, G4 as MIDI numbers
                stepDuration: 0.25
            });

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps[0].pitch).toBe(60);
            expect(noteOps[1].pitch).toBe(64);
            expect(noteOps[2].pitch).toBe(67);
        });
    });
});
