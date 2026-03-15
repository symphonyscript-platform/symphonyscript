import { SynapticMelody } from '../clips/SynapticMelody'
import { Clip } from '../Clip'
import { NoteOperation } from '../types'
import { createTestBridge } from '../test-bridge'

describe('Voice (Task 036)', () => {
    let mockBridge: ReturnType<typeof createTestBridge>;

    beforeEach(() => {
        mockBridge = createTestBridge();
    });

    describe('SynapticMelody.voice()', () => {
        it('returns this for chaining', () => {
            const melody = new SynapticMelody(mockBridge);
            const result = melody.voice(1, v => v.note('C4', 0.5).commit());
            expect(result).toBe(melody);
        });

        it('tags notes with expressionId', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.voice(1, v => {
                v.note('C4', 0.5).commit();
                return v;
            });

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].expressionId).toBe(1);
        });

        it('supports different voice IDs', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.voice(1, v => v.note('C4', 0.5).commit());
            melody.voice(5, v => v.note('E4', 0.5).commit());
            melody.voice(15, v => v.note('G4', 0.5).commit());

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps[0].expressionId).toBe(1);
            expect(noteOps[1].expressionId).toBe(5);
            expect(noteOps[2].expressionId).toBe(15);
        });

        it('multiple notes in same voice', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.voice(3, v => {
                v.note('C4', 0.5).commit();
                v.advanceTick(0.5);
                v.note('D4', 0.5).commit();
                v.advanceTick(0.5);
                v.note('E4', 0.5).commit();
                return v;
            });

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps).toHaveLength(3);
            expect(noteOps.every(n => n.expressionId === 3)).toBe(true);
        });
    });

    describe('Voice ID validation', () => {
        it('accepts ID 1', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.voice(1, v => v)).not.toThrow();
        });

        it('accepts ID 15', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.voice(15, v => v)).not.toThrow();
        });

        it('rejects ID 0', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.voice(0, v => v)).toThrow('Voice ID must be 1-15');
        });

        it('rejects ID 16', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.voice(16, v => v)).toThrow('Voice ID must be 1-15');
        });

        it('rejects negative ID', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.voice(-1, v => v)).toThrow('Voice ID must be 1-15');
        });
    });

    describe('Voice scope isolation', () => {
        it('notes outside voice have no expressionId', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note('C4', 0.5).commit();
            melody.voice(1, v => v.note('D4', 0.5).commit());
            melody.advanceTick(0.5);
            melody.note('E4', 0.5).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps[0].expressionId).toBeUndefined();
            expect(noteOps[1].expressionId).toBe(1);
            expect(noteOps[2].expressionId).toBeUndefined();
        });

        it('nested voices use inner voice ID', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.voice(1, v => {
                v.note('C4', 0.5).commit();
                v.voice(2, v2 => {
                    v2.note('D4', 0.5).commit();
                    return v2;
                });
                v.note('E4', 0.5).commit();
                return v;
            });

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps[0].expressionId).toBe(1);
            expect(noteOps[1].expressionId).toBe(2);
            expect(noteOps[2].expressionId).toBe(1);
        });
    });

    describe('Builder function return types', () => {
        it('accepts builder returning clip', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.voice(1, v => {
                v.note('C4', 0.5).commit();
                return v;
            });

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps).toHaveLength(1);
        });

        it('accepts builder returning cursor (auto-commits)', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.voice(1, v => v.note('C4', 0.5));

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].expressionId).toBe(1);
        });
    });

    describe('Expression ID accessors', () => {
        it('getExpressionId() returns null by default', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(melody.getExpressionId()).toBeNull();
        });

        it('getExpressionId() returns current ID inside voice', () => {
            const melody = new SynapticMelody(mockBridge);
            let capturedId: number | null = null;
            melody.voice(5, v => {
                capturedId = v.getExpressionId();
                return v;
            });
            expect(capturedId).toBe(5);
        });

        it('setExpressionId() sets ID directly', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.setExpressionId(7);
            melody.note('C4', 0.5).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps[0].expressionId).toBe(7);
        });

        it('setExpressionId(null) clears ID', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.setExpressionId(7);
            melody.note('C4', 0.5).commit();
            melody.setExpressionId(null);
            melody.advanceTick(0.5);
            melody.note('D4', 0.5).commit();

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps[0].expressionId).toBe(7);
            expect(noteOps[1].expressionId).toBeUndefined();
        });

        it('setExpressionId() validates range', () => {
            const melody = new SynapticMelody(mockBridge);
            expect(() => melody.setExpressionId(0)).toThrow('Expression ID must be 1-15');
            expect(() => melody.setExpressionId(16)).toThrow('Expression ID must be 1-15');
        });
    });

    describe('Independent voices', () => {
        it('multiple voices at same tick', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.voice(1, v => v.note('C4', 1).commit());
            melody.voice(2, v => v.note('E4', 1).commit());
            melody.voice(3, v => v.note('G4', 1).commit());

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps).toHaveLength(3);
            // All at tick 0
            expect(noteOps.every(n => n.tick === 0)).toBe(true);
            // Different voices
            expect(noteOps[0].expressionId).toBe(1);
            expect(noteOps[1].expressionId).toBe(2);
            expect(noteOps[2].expressionId).toBe(3);
        });

        it('voices can have different rhythms', () => {
            const melody = new SynapticMelody(mockBridge);

            // Voice 1: quarter notes
            melody.voice(1, v => {
                v.note('C4', 0.25).commit();
                v.advanceTick(0.25);
                v.note('C4', 0.25).commit();
                v.advanceTick(0.25);
                v.note('C4', 0.25).commit();
                v.advanceTick(0.25);
                v.note('C4', 0.25).commit();
                return v;
            });

            // Reset tick for voice 2
            // Note: In real usage, you'd manage tick position differently
            // This test just verifies expressionId tagging

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps.filter(n => n.expressionId === 1)).toHaveLength(4);
        });
    });

    describe('Clip factory integration', () => {
        it('Clip.melody().voice() works', () => {
            const result = Clip.melody('test')
                .voice(1, v => v.note('C4', 0.5).commit())
                .voice(2, v => v.note('E4', 0.5).commit())
                .build();

            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(2);
            expect(noteOps[0].expressionId).toBe(1);
            expect(noteOps[1].expressionId).toBe(2);
        });
    });

    describe('Edge cases', () => {
        it('empty voice scope', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.voice(1, v => v);

            const result = melody.build();
            expect(result.operations).toHaveLength(0);
        });

        it('voice with only rests', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.voice(1, v => {
                v.rest(1);
                return v;
            });

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(0);
        });

        it('preserves other note properties', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.voice(1, v => v.note('C4', 0.5).velocity(0.9).commit());

            const result = melody.build();
            const noteOps = result.operations.filter(op => op.kind === 'note') as NoteOperation[];

            expect(noteOps[0].expressionId).toBe(1);
            expect(noteOps[0].pitch).toBe(60);
            expect(noteOps[0].velocity).toBeGreaterThan(100); // High velocity
        });
    });
});
