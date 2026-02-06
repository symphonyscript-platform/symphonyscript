/**
 * TempoEnvelope Tests - Task 042
 * Tests multi-keyframe tempo transitions for SynapticClip.
 */

import { Clip } from '../Clip';
import { TempoEnvelopeOp, TempoKeyframe } from '../types';

describe('TempoEnvelope (Task 042)', () => {
    describe('Basic Functionality', () => {
        it('creates a tempo envelope with 2 keyframes', () => {
            const melody = Clip.melody('test');
            
            melody.tempoEnvelope([
                { beat: 0, bpm: 120 },
                { beat: 4, bpm: 140 }
            ]);
            
            const node = melody.build();
            const envelopeOps = node.operations.filter(op => op.kind === 'tempoEnvelope') as TempoEnvelopeOp[];
            
            expect(envelopeOps).toHaveLength(1);
            expect(envelopeOps[0].keyframes).toHaveLength(2);
            expect(envelopeOps[0].keyframes[0].bpm).toBe(120);
            expect(envelopeOps[0].keyframes[1].bpm).toBe(140);
        });

        it('creates a tempo envelope with 3 keyframes', () => {
            const melody = Clip.melody('test');
            
            melody.tempoEnvelope([
                { beat: 0, bpm: 120 },
                { beat: 4, bpm: 140 },
                { beat: 8, bpm: 120 }
            ]);
            
            const node = melody.build();
            const envelopeOps = node.operations.filter(op => op.kind === 'tempoEnvelope') as TempoEnvelopeOp[];
            
            expect(envelopeOps).toHaveLength(1);
            expect(envelopeOps[0].keyframes).toHaveLength(3);
        });

        it('records tick position', () => {
            const melody = Clip.melody('test');
            
            melody.note('C4', 1).commit();
            melody.advanceTick(1);
            melody.tempoEnvelope([
                { beat: 0, bpm: 120 },
                { beat: 4, bpm: 140 }
            ]);
            
            const node = melody.build();
            const envelopeOps = node.operations.filter(op => op.kind === 'tempoEnvelope') as TempoEnvelopeOp[];
            
            expect(envelopeOps[0].tick).toBe(1);
        });

        it('updates current tempo to final keyframe', () => {
            const melody = Clip.melody('test');
            
            melody.tempo(100);
            melody.tempoEnvelope([
                { beat: 0, bpm: 120 },
                { beat: 4, bpm: 180 }
            ]);
            
            const node = melody.build();
            expect(node.tempo).toBe(180);
        });
    });

    describe('Curve Types', () => {
        it('supports linear curve', () => {
            const melody = Clip.melody('test');
            
            melody.tempoEnvelope([
                { beat: 0, bpm: 120 },
                { beat: 4, bpm: 140, curve: 'linear' }
            ]);
            
            const node = melody.build();
            const envelopeOps = node.operations.filter(op => op.kind === 'tempoEnvelope') as TempoEnvelopeOp[];
            
            expect(envelopeOps[0].keyframes[1].curve).toBe('linear');
        });

        it('supports ease-in curve', () => {
            const melody = Clip.melody('test');
            
            melody.tempoEnvelope([
                { beat: 0, bpm: 120 },
                { beat: 4, bpm: 140, curve: 'ease-in' }
            ]);
            
            const node = melody.build();
            const envelopeOps = node.operations.filter(op => op.kind === 'tempoEnvelope') as TempoEnvelopeOp[];
            
            expect(envelopeOps[0].keyframes[1].curve).toBe('ease-in');
        });

        it('supports ease-out curve', () => {
            const melody = Clip.melody('test');
            
            melody.tempoEnvelope([
                { beat: 0, bpm: 120 },
                { beat: 4, bpm: 140, curve: 'ease-out' }
            ]);
            
            const node = melody.build();
            const envelopeOps = node.operations.filter(op => op.kind === 'tempoEnvelope') as TempoEnvelopeOp[];
            
            expect(envelopeOps[0].keyframes[1].curve).toBe('ease-out');
        });

        it('supports ease-in-out curve', () => {
            const melody = Clip.melody('test');
            
            melody.tempoEnvelope([
                { beat: 0, bpm: 120 },
                { beat: 4, bpm: 140, curve: 'ease-in-out' }
            ]);
            
            const node = melody.build();
            const envelopeOps = node.operations.filter(op => op.kind === 'tempoEnvelope') as TempoEnvelopeOp[];
            
            expect(envelopeOps[0].keyframes[1].curve).toBe('ease-in-out');
        });

        it('supports mixed curves', () => {
            const melody = Clip.melody('test');
            
            melody.tempoEnvelope([
                { beat: 0, bpm: 120 },
                { beat: 4, bpm: 140, curve: 'ease-in' },
                { beat: 8, bpm: 120, curve: 'ease-out' }
            ]);
            
            const node = melody.build();
            const envelopeOps = node.operations.filter(op => op.kind === 'tempoEnvelope') as TempoEnvelopeOp[];
            
            expect(envelopeOps[0].keyframes[1].curve).toBe('ease-in');
            expect(envelopeOps[0].keyframes[2].curve).toBe('ease-out');
        });
    });

    describe('Error Handling', () => {
        it('throws for 0 keyframes', () => {
            const melody = Clip.melody('test');
            
            expect(() => melody.tempoEnvelope([])).toThrow(
                'tempoEnvelope() requires at least 2 keyframes'
            );
        });

        it('throws for 1 keyframe', () => {
            const melody = Clip.melody('test');
            
            expect(() => melody.tempoEnvelope([
                { beat: 0, bpm: 120 }
            ])).toThrow(
                'tempoEnvelope() requires at least 2 keyframes'
            );
        });
    });

    describe('Chaining', () => {
        it('returns this for chaining', () => {
            const melody = Clip.melody('test');
            
            const result = melody.tempoEnvelope([
                { beat: 0, bpm: 120 },
                { beat: 4, bpm: 140 }
            ]);
            
            expect(result).toBe(melody);
        });

        it('chains with note methods', () => {
            const melody = Clip.melody('test');
            
            melody
                .tempoEnvelope([
                    { beat: 0, bpm: 120 },
                    { beat: 4, bpm: 140 }
                ])
                .note('C4', 1).commit();
            
            const node = melody.build();
            const envelopeOps = node.operations.filter(op => op.kind === 'tempoEnvelope') as TempoEnvelopeOp[];
            const noteOps = node.operations.filter(op => op.kind === 'note');
            
            expect(envelopeOps).toHaveLength(1);
            expect(noteOps).toHaveLength(1);
        });

        it('chains multiple tempo envelopes', () => {
            const melody = Clip.melody('test');
            
            melody.tempoEnvelope([
                { beat: 0, bpm: 120 },
                { beat: 4, bpm: 140 }
            ]);
            
            melody.note('C4', 4).commit();
            melody.advanceTick(4);
            
            melody.tempoEnvelope([
                { beat: 0, bpm: 140 },
                { beat: 4, bpm: 100 }
            ]);
            
            const node = melody.build();
            const envelopeOps = node.operations.filter(op => op.kind === 'tempoEnvelope') as TempoEnvelopeOp[];
            
            expect(envelopeOps).toHaveLength(2);
            expect(envelopeOps[0].tick).toBe(0);
            expect(envelopeOps[1].tick).toBe(4);
        });
    });

    describe('Cursor Escape', () => {
        it('works from cursor via escape method', () => {
            const melody = Clip.melody('test');
            
            melody.note('C4', 1).tempoEnvelope([
                { beat: 0, bpm: 120 },
                { beat: 4, bpm: 140 }
            ]);
            
            const node = melody.build();
            const envelopeOps = node.operations.filter(op => op.kind === 'tempoEnvelope') as TempoEnvelopeOp[];
            const noteOps = node.operations.filter(op => op.kind === 'note');
            
            expect(envelopeOps).toHaveLength(1);
            expect(noteOps).toHaveLength(1);
        });

        it('commits pending note before envelope', () => {
            const melody = Clip.melody('test');
            
            melody.note('C4', 1).tempoEnvelope([
                { beat: 0, bpm: 120 },
                { beat: 4, bpm: 140 }
            ]);
            
            const node = melody.build();
            const noteOps = node.operations.filter(op => op.kind === 'note');
            
            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].pitch).toBe(60);
        });
    });

    describe('Integration', () => {
        it('works with drums', () => {
            const drums = Clip.drums('test');
            
            drums.tempoEnvelope([
                { beat: 0, bpm: 120 },
                { beat: 4, bpm: 160 }
            ]);
            
            drums.kick().commit();
            
            const node = drums.build();
            const envelopeOps = node.operations.filter(op => op.kind === 'tempoEnvelope') as TempoEnvelopeOp[];
            
            expect(envelopeOps).toHaveLength(1);
        });

        it('works with time signature', () => {
            const melody = Clip.melody('test')
                .timeSignature(3, 4)
                .tempoEnvelope([
                    { beat: 0, bpm: 120 },
                    { beat: 3, bpm: 140 }
                ]);
            
            const node = melody.build();
            expect(node.timeSignature).toEqual([3, 4]);
            
            const envelopeOps = node.operations.filter(op => op.kind === 'tempoEnvelope') as TempoEnvelopeOp[];
            expect(envelopeOps).toHaveLength(1);
        });

        it('preserves keyframe data immutably', () => {
            const melody = Clip.melody('test');
            
            const keyframes: TempoKeyframe[] = [
                { beat: 0, bpm: 120 },
                { beat: 4, bpm: 140 }
            ];
            
            melody.tempoEnvelope(keyframes);
            
            // Modify original array
            keyframes[0].bpm = 999;
            
            const node = melody.build();
            const envelopeOps = node.operations.filter(op => op.kind === 'tempoEnvelope') as TempoEnvelopeOp[];
            
            // Should not be affected
            expect(envelopeOps[0].keyframes[0].bpm).toBe(120);
        });
    });

    describe('Complex Patterns', () => {
        it('accelerando pattern', () => {
            const melody = Clip.melody('test');
            
            melody.tempoEnvelope([
                { beat: 0, bpm: 80 },
                { beat: 8, bpm: 120, curve: 'ease-in' }
            ]);
            
            const node = melody.build();
            const envelopeOps = node.operations.filter(op => op.kind === 'tempoEnvelope') as TempoEnvelopeOp[];
            
            expect(envelopeOps[0].keyframes[0].bpm).toBe(80);
            expect(envelopeOps[0].keyframes[1].bpm).toBe(120);
        });

        it('ritardando pattern', () => {
            const melody = Clip.melody('test');
            
            melody.tempoEnvelope([
                { beat: 0, bpm: 120 },
                { beat: 8, bpm: 60, curve: 'ease-out' }
            ]);
            
            const node = melody.build();
            const envelopeOps = node.operations.filter(op => op.kind === 'tempoEnvelope') as TempoEnvelopeOp[];
            
            expect(envelopeOps[0].keyframes[0].bpm).toBe(120);
            expect(envelopeOps[0].keyframes[1].bpm).toBe(60);
        });

        it('rubato-style tempo variation', () => {
            const melody = Clip.melody('test');
            
            melody.tempoEnvelope([
                { beat: 0, bpm: 100 },
                { beat: 2, bpm: 90, curve: 'ease-out' },
                { beat: 4, bpm: 110, curve: 'ease-in' },
                { beat: 6, bpm: 95, curve: 'ease-out' },
                { beat: 8, bpm: 100, curve: 'ease-in-out' }
            ]);
            
            const node = melody.build();
            const envelopeOps = node.operations.filter(op => op.kind === 'tempoEnvelope') as TempoEnvelopeOp[];
            
            expect(envelopeOps[0].keyframes).toHaveLength(5);
        });
    });
});
