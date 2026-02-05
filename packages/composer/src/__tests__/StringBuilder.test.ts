import { StringBuilder } from '../clips/StringBuilder';
import { Clip } from '../Clip';
import { SiliconBridge } from '@symphonyscript/kernel';
import { PitchBendOperation } from '../types';

describe('StringBuilder', () => {
    let stringBuilder: StringBuilder;
    let mockBridge: jest.Mocked<SiliconBridge>;

    beforeEach(() => {
        mockBridge = {
            insertAsync: jest.fn().mockReturnValue(0)
        } as any;
        stringBuilder = new StringBuilder(mockBridge);
    });

    describe('class structure', () => {
        it('extends SynapticMelody', () => {
            expect(typeof stringBuilder.note).toBe('function');
            expect(typeof stringBuilder.chord).toBe('function');
            expect(typeof stringBuilder.degree).toBe('function');
            expect(typeof stringBuilder.key).toBe('function');
        });
    });

    describe('bend()', () => {
        it('queues pitch bend at current tick for positive semitones', () => {
            stringBuilder.bend(2);

            const result = stringBuilder.build();
            const pitchBendOps = result.operations.filter(op => op.kind === 'pitchBend') as PitchBendOperation[];

            expect(pitchBendOps).toHaveLength(1);
            expect(pitchBendOps[0].tick).toBe(0);
            // 2 semitones = full range = 8191 (max)
            expect(pitchBendOps[0].value).toBe(8191);
        });

        it('queues pitch bend for 1 semitone', () => {
            stringBuilder.bend(1);

            const result = stringBuilder.build();
            const pitchBendOps = result.operations.filter(op => op.kind === 'pitchBend') as PitchBendOperation[];

            // 1 semitone = half range = 4095 or 4096
            expect(pitchBendOps[0].value).toBeCloseTo(4096, -1); // Allow rounding
        });

        it('queues pitch bend for negative semitones', () => {
            stringBuilder.bend(-2);

            const result = stringBuilder.build();
            const pitchBendOps = result.operations.filter(op => op.kind === 'pitchBend') as PitchBendOperation[];

            // -2 semitones = -8192 (min) or close to it
            expect(pitchBendOps[0].value).toBeLessThan(0);
            expect(pitchBendOps[0].value).toBeCloseTo(-8191, -1);
        });

        it('returns this for chaining', () => {
            const result = stringBuilder.bend(1);
            expect(result).toBe(stringBuilder);
        });

        it('records tick position correctly', () => {
            stringBuilder.note('C4', 1).commit();
            stringBuilder.advanceTick(1);
            stringBuilder.bend(2);

            const result = stringBuilder.build();
            const pitchBendOps = result.operations.filter(op => op.kind === 'pitchBend') as PitchBendOperation[];

            expect(pitchBendOps[0].tick).toBe(1);
        });

        it('throws for semitones > 12', () => {
            expect(() => stringBuilder.bend(13)).toThrow('bend() semitones must be -12 to +12, got 13');
        });

        it('throws for semitones < -12', () => {
            expect(() => stringBuilder.bend(-13)).toThrow('bend() semitones must be -12 to +12, got -13');
        });
    });

    describe('bendReset()', () => {
        it('queues pitch bend = 0 at current tick', () => {
            stringBuilder.bendReset();

            const result = stringBuilder.build();
            const pitchBendOps = result.operations.filter(op => op.kind === 'pitchBend') as PitchBendOperation[];

            expect(pitchBendOps).toHaveLength(1);
            expect(pitchBendOps[0].value).toBe(0);
            expect(pitchBendOps[0].tick).toBe(0);
        });

        it('returns this for chaining', () => {
            const result = stringBuilder.bendReset();
            expect(result).toBe(stringBuilder);
        });
    });

    describe('slide()', () => {
        it('creates a note with legato articulation', () => {
            stringBuilder.slide('E4', 0.5);

            const result = stringBuilder.build();
            const noteOps = result.operations.filter(op => op.kind === 'note');

            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].pitch).toBe(64); // E4 = 64
            expect(noteOps[0].duration).toBe(0.5);
        });

        it('advances tick after slide', () => {
            stringBuilder.slide('E4', 0.5);

            expect(stringBuilder.getCurrentTick()).toBe(0.5);
        });

        it('accepts numeric pitch', () => {
            stringBuilder.slide(64, 0.5); // E4 as number

            const result = stringBuilder.build();
            const noteOps = result.operations.filter(op => op.kind === 'note');

            expect(noteOps[0].pitch).toBe(64);
        });

        it('returns this for chaining', () => {
            const result = stringBuilder.slide('E4', 0.5);
            expect(result).toBe(stringBuilder);
        });
    });

    describe('bend + slide workflow', () => {
        it('typical string bend workflow', () => {
            stringBuilder.note('C4', 1).commit();
            stringBuilder.advanceTick(1);
            stringBuilder.bend(2);
            stringBuilder.slide('E4', 0.5);
            stringBuilder.bendReset();

            const result = stringBuilder.build();
            const noteOps = result.operations.filter(op => op.kind === 'note');
            const pitchBendOps = result.operations.filter(op => op.kind === 'pitchBend') as PitchBendOperation[];

            expect(noteOps).toHaveLength(2); // C4 + E4 slide
            expect(pitchBendOps).toHaveLength(2); // bend + reset
            expect(pitchBendOps[0].value).toBe(8191); // bend up
            expect(pitchBendOps[1].value).toBe(0); // reset
        });

        it('operations maintain correct tick order', () => {
            stringBuilder.note('C4', 1).commit();
            stringBuilder.advanceTick(1);
            stringBuilder.bend(1);
            stringBuilder.note('D4', 1).commit();
            stringBuilder.advanceTick(1);
            stringBuilder.bendReset();

            const result = stringBuilder.build();
            const pitchBendOps = result.operations.filter(op => op.kind === 'pitchBend') as PitchBendOperation[];

            expect(pitchBendOps[0].tick).toBe(1); // bend at tick 1
            expect(pitchBendOps[1].tick).toBe(2); // reset at tick 2
        });
    });

    describe('Clip.string() factory', () => {
        it('creates a StringBuilder instance', () => {
            const violin = Clip.string('Violin');

            expect(violin).toBeInstanceOf(StringBuilder);
        });

        it('factory result has bend/slide/bendReset methods', () => {
            const violin = Clip.string('Violin');

            expect(typeof violin.bend).toBe('function');
            expect(typeof violin.slide).toBe('function');
            expect(typeof violin.bendReset).toBe('function');
        });

        it('full workflow with factory', () => {
            const violin = Clip.string('Violin')
                .note('C4', 1).rest(1)
                .bend(2)
                .slide('E4', 0.5)
                .bendReset();

            const result = violin.build();

            expect(result.operations.filter(op => op.kind === 'note').length).toBe(2);
            expect(result.operations.filter(op => op.kind === 'pitchBend').length).toBe(2);
        });
    });

    describe('chaining with melody methods', () => {
        it('bend chains with note methods', () => {
            stringBuilder.setScale('C', 'major');
            stringBuilder.bend(1);
            stringBuilder.degree(1, 1).commit();
            stringBuilder.advanceTick(1);
            stringBuilder.degree(3, 1).commit();
            stringBuilder.bendReset();

            const result = stringBuilder.build();

            expect(result.operations.filter(op => op.kind === 'note').length).toBeGreaterThan(0);
            expect(result.operations.filter(op => op.kind === 'pitchBend').length).toBe(2);
        });

        it('dynamics work with string builder', () => {
            stringBuilder.crescendo(4);
            stringBuilder.bend(1);
            stringBuilder.note('C4', 1).commit();
            stringBuilder.advanceTick(1);
            stringBuilder.note('D4', 1).commit();

            const result = stringBuilder.build();
            const notes = result.operations.filter(op => op.kind === 'note');

            // Crescendo should affect velocities
            expect(notes[0].velocity).toBeLessThan(notes[1].velocity);
        });
    });

    describe('pitch bend value calculations', () => {
        it('bend(0) produces value 0', () => {
            stringBuilder.bend(0);
            const result = stringBuilder.build();
            const pitchBendOps = result.operations.filter(op => op.kind === 'pitchBend') as PitchBendOperation[];
            expect(pitchBendOps[0].value).toBe(0);
        });

        it('bend values are clamped to valid MIDI range', () => {
            // Even with large semitone values, should stay within -8192 to 8191
            stringBuilder.bend(12);
            const result = stringBuilder.build();
            const pitchBendOps = result.operations.filter(op => op.kind === 'pitchBend') as PitchBendOperation[];
            
            expect(pitchBendOps[0].value).toBeLessThanOrEqual(8191);
            expect(pitchBendOps[0].value).toBeGreaterThanOrEqual(-8192);
        });
    });
});
