import { KeyboardBuilder } from '../clips/KeyboardBuilder';
import { Clip } from '../Clip';
import { SiliconBridge } from '@symphonyscript/kernel';
import { CCOperation } from '../types';

describe('KeyboardBuilder', () => {
    let keyboard: KeyboardBuilder;
    let mockBridge: jest.Mocked<SiliconBridge>;

    beforeEach(() => {
        mockBridge = {
            insertAsync: jest.fn().mockReturnValue(0)
        } as any;
        keyboard = new KeyboardBuilder(mockBridge);
    });

    describe('class structure', () => {
        it('extends SynapticMelody', () => {
            // KeyboardBuilder should have all SynapticMelody methods
            expect(typeof keyboard.note).toBe('function');
            expect(typeof keyboard.chord).toBe('function');
            expect(typeof keyboard.degree).toBe('function');
            expect(typeof keyboard.key).toBe('function');
        });
    });

    describe('sustain()', () => {
        it('queues CC64 = 127 at current tick', () => {
            keyboard.sustain();

            const result = keyboard.build();
            const ccOps = result.operations.filter(op => op.kind === 'cc') as CCOperation[];

            expect(ccOps).toHaveLength(1);
            expect(ccOps[0].controller).toBe(64);
            expect(ccOps[0].value).toBe(127);
            expect(ccOps[0].tick).toBe(0);
        });

        it('returns this for chaining', () => {
            const result = keyboard.sustain();
            expect(result).toBe(keyboard);
        });

        it('records tick position correctly', () => {
            keyboard.note('C4', 1).commit();
            keyboard.advanceTick(1);
            keyboard.sustain();

            const result = keyboard.build();
            const ccOps = result.operations.filter(op => op.kind === 'cc') as CCOperation[];

            expect(ccOps[0].tick).toBe(1);
        });
    });

    describe('release()', () => {
        it('queues CC64 = 0 at current tick', () => {
            keyboard.release();

            const result = keyboard.build();
            const ccOps = result.operations.filter(op => op.kind === 'cc') as CCOperation[];

            expect(ccOps).toHaveLength(1);
            expect(ccOps[0].controller).toBe(64);
            expect(ccOps[0].value).toBe(0);
            expect(ccOps[0].tick).toBe(0);
        });

        it('returns this for chaining', () => {
            const result = keyboard.release();
            expect(result).toBe(keyboard);
        });
    });

    describe('sustain/release workflow', () => {
        it('sustain then release creates two CC operations', () => {
            keyboard.sustain();
            keyboard.note('C4', 1).commit();
            keyboard.note('E4', 1).commit();
            keyboard.release();

            const result = keyboard.build();
            const ccOps = result.operations.filter(op => op.kind === 'cc') as CCOperation[];

            expect(ccOps).toHaveLength(2);
            expect(ccOps[0].value).toBe(127); // sustain on
            expect(ccOps[1].value).toBe(0);   // sustain off
        });

        it('notes and CC operations coexist in build output', () => {
            keyboard.sustain();
            keyboard.note('C4', 1).commit();
            keyboard.release();

            const result = keyboard.build();
            const noteOps = result.operations.filter(op => op.kind === 'note');
            const ccOps = result.operations.filter(op => op.kind === 'cc');

            expect(noteOps).toHaveLength(1);
            expect(ccOps).toHaveLength(2);
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

        it('full workflow with factory', () => {
            const piano = Clip.keyboard('Piano')
                .sustain()
                .note('C4', 1).rest(1)
                .note('E4', 1).rest(1)
                .release();

            const result = piano.build();

            // Should have notes and CC operations
            expect(result.operations.filter(op => op.kind === 'note').length).toBeGreaterThan(0);
            expect(result.operations.filter(op => op.kind === 'cc').length).toBe(2);
        });
    });

    describe('chaining with melody methods', () => {
        it('sustain chains with note methods', () => {
            keyboard.key('C', 'major');
            keyboard.sustain();
            keyboard.chord('Cmaj').commit();
            keyboard.release();

            const result = keyboard.build();

            expect(result.operations.filter(op => op.kind === 'note').length).toBeGreaterThan(0);
            expect(result.operations.filter(op => op.kind === 'cc').length).toBe(2);
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

            // Crescendo should affect velocities
            expect(notes[0].velocity).toBeLessThan(notes[1].velocity);
        });
    });
});
