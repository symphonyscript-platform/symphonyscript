import { KeyboardBuilder } from '../clips/KeyboardBuilder'
import { Clip } from '../Clip'
import { ScaleMode } from '../types'
import { createTestBridge } from '../test-bridge'

describe('KeyboardBuilder', () => {
    let keyboard: KeyboardBuilder;
    let mockBridge: ReturnType<typeof createTestBridge>;

    beforeEach(() => {
        mockBridge = createTestBridge();
        keyboard = new KeyboardBuilder(mockBridge);
    });

    describe('class structure', () => {
        it('extends SynapticMelody', () => {
            expect(typeof keyboard.note).toBe('function');
            expect(typeof keyboard.chord).toBe('function');
            expect(typeof keyboard.degree).toBe('function');
            expect(typeof keyboard.key).toBe('function');
        });
    });

    describe('sustain()', () => {
        it('returns this for chaining', () => {
            const result = keyboard.sustain();
            expect(result).toBe(keyboard);
        });
    });

    describe('release()', () => {
        it('returns this for chaining', () => {
            const result = keyboard.release();
            expect(result).toBe(keyboard);
        });
    });

    describe('Clip.keyboard() factory', () => {
        it('creates a KeyboardBuilder instance', () => {
            const piano = Clip.keyboard('Piano');
            expect(piano).toBeInstanceOf(KeyboardBuilder);
        });

        it('factory result has sustain/release methods', () => {
            const piano = Clip.keyboard('Piano');
            expect(typeof piano.sustain).toBe('function');
            expect(typeof piano.release).toBe('function');
        });

        it('full workflow with factory produces notes', () => {
            const piano = Clip.keyboard('Piano')
                .sustain()
                .note('C4', 1).rest(1)
                .note('E4', 1).rest(1)
                .release();

            const result = piano.build();
            expect(result.operations.filter(op => op.kind === 'note').length).toBeGreaterThan(0);
        });
    });

    describe('chaining with melody methods', () => {
        it('sustain chains with note methods', () => {
            keyboard.key('C', ScaleMode.MAJOR);
            keyboard.sustain();
            keyboard.chord('Cmaj').commit();
            keyboard.release();

            const result = keyboard.build();
            expect(result.operations.filter(op => op.kind === 'note').length).toBeGreaterThan(0);
        });

        it('dynamics work with keyboard', () => {
            keyboard.crescendo(4);
            keyboard.sustain();
            keyboard.note('C4', 1).commit();
            keyboard.advanceTick(1);
            keyboard.note('D4', 1).commit();
            keyboard.release();

            const result = keyboard.build();
            const notes = result.operations.filter(op => op.kind === 'note');
            expect(notes[0].velocity).toBeLessThan(notes[1].velocity);
        });
    });
});
