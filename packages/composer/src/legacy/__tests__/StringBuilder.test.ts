import { StringBuilder } from '../clips/StringBuilder'
import { Clip } from '../Clip'
import { ScaleMode } from '../types'
import { createTestBridge } from '../test-bridge'

describe('StringBuilder', () => {
    let stringBuilder: StringBuilder;
    let mockBridge: ReturnType<typeof createTestBridge>;

    beforeEach(() => {
        mockBridge = createTestBridge();
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
        it('returns this for chaining', () => {
            const result = stringBuilder.bend(1);
            expect(result).toBe(stringBuilder);
        });
    });

    describe('slide()', () => {
        it('creates a note with legato articulation', () => {
            stringBuilder.note('C4', 0.25).commit();
            stringBuilder.slide('E4', 0.5);  // slide() commits internally
            const result = stringBuilder.build();
            const noteOps = result.operations.filter(op => op.kind === 'note');
            expect(noteOps.length).toBeGreaterThan(0);
        });
    });

    describe('Clip.string() factory', () => {
        it('creates a StringBuilder instance', () => {
            const guitar = Clip.string('Guitar');
            expect(guitar).toBeInstanceOf(StringBuilder);
        });

        it('full workflow with factory produces notes', () => {
            const guitar = Clip.string('Guitar');
            guitar.bend(1).note('C4', 0.5).commit();
            guitar.slide('E4', 0.5);  // slide() commits internally

            const result = guitar.build();
            expect(result.operations.filter(op => op.kind === 'note').length).toBeGreaterThan(0);
        });
    });

    describe('chaining with melody methods', () => {
        it('bend chains with note methods', () => {
            stringBuilder.setScale('C', ScaleMode.MAJOR).bend(0.5).degree(1, 1).commit();

            const result = stringBuilder.build();
            expect(result.operations.filter(op => op.kind === 'note').length).toBeGreaterThan(0);
        });

        it('dynamics work with string builder', () => {
            stringBuilder.crescendo(4).note('C4', 1).commit();
            stringBuilder.advanceTick(1);
            stringBuilder.note('D4', 1).commit();

            const result = stringBuilder.build();
            const notes = result.operations.filter(op => op.kind === 'note');
            expect(notes[0].velocity).toBeLessThan(notes[1].velocity);
        });
    });
});
