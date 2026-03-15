/**
 * TempoEnvelope Tests - Task 042
 * Task 058: tempoEnvelope no longer stored in operations; tests verify currentTempo and API.
 */

import { Clip } from '../Clip';
import { CurveType } from '../types';

describe('TempoEnvelope (Task 042)', () => {
    describe('Basic Functionality', () => {
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

    describe('Error Handling', () => {
        it('throws for 0 keyframes', () => {
            const melody = Clip.melody('test');
            expect(() => melody.tempoEnvelope([])).toThrow(
                'tempoEnvelope() requires at least 2 keyframes'
            );
        });

        it('throws for 1 keyframe', () => {
            const melody = Clip.melody('test');
            expect(() => melody.tempoEnvelope([{ beat: 0, bpm: 120 }])).toThrow(
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
                .tempoEnvelope([{ beat: 0, bpm: 120 }, { beat: 4, bpm: 140 }])
                .note('C4', 1).commit();
            const node = melody.build();
            const noteOps = node.operations.filter(op => op.kind === 'note');
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
            drums.tempoEnvelope([{ beat: 0, bpm: 120 }, { beat: 4, bpm: 160 }]);
            drums.kick().commit();
            const node = drums.build();
            expect(node.tempo).toBe(160);
        });

        it('works with time signature', () => {
            const melody = Clip.melody('test')
                .timeSignature(3, 4)
                .tempoEnvelope([{ beat: 0, bpm: 120 }, { beat: 3, bpm: 140 }]);
            const node = melody.build();
            expect(node.timeSignature).toEqual([3, 4]);
            expect(node.tempo).toBe(140);
        });
    });

    describe('Complex Patterns', () => {
        it('accelerando updates tempo', () => {
            const melody = Clip.melody('test');
            melody.tempoEnvelope([
                { beat: 0, bpm: 80 },
                { beat: 8, bpm: 120, curve: CurveType.EASE_IN }
            ]);
            const node = melody.build();
            expect(node.tempo).toBe(120);
        });

        it('ritardando updates tempo', () => {
            const melody = Clip.melody('test');
            melody.tempoEnvelope([
                { beat: 0, bpm: 120 },
                { beat: 8, bpm: 60, curve: CurveType.EASE_OUT }
            ]);
            const node = melody.build();
            expect(node.tempo).toBe(60);
        });
    });
});
