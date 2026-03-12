import { SynapticCursor } from '../cursors/SynapticCursor';
import { SynapticClip } from '../clips/SynapticClip';
import { SiliconBridge } from '@symphonyscript/kernel';

// Mocks
const mockBridge = {} as SiliconBridge;

class MockClip extends SynapticClip {
    getCurrentTick() { return 0; }
    advanceTick(ticks: number) { }
    generateSourceId() { return 1; }
    commit() { }
    rest = jest.fn().mockImplementation(() => this);
    tempo = jest.fn().mockImplementation(() => this);
    timeSignature = jest.fn().mockImplementation(() => this);
    swing = jest.fn().mockImplementation(() => this);
    groove = jest.fn().mockImplementation(() => this);
    control = jest.fn().mockImplementation(() => this);
    stack = jest.fn().mockImplementation(() => this);
    setLoopRegion = jest.fn().mockImplementation(() => this);
    pushState = jest.fn().mockImplementation(() => this);
    popState = jest.fn().mockImplementation(() => this);
}

class TestCursor extends SynapticCursor {
    commitCalls = 0;
    commit() {
        this.commitCalls++;
        this.hasPending = false;
    }
}

describe('SynapticCursor (Phase 1)', () => {
    let clip: MockClip;
    let cursor: TestCursor;

    beforeEach(() => {
        clip = new MockClip(mockBridge);
        cursor = new TestCursor(clip, mockBridge);
    });

    describe('Modifiers', () => {
        it('chaining returns this', () => {
            expect(cursor.velocity(0.5)).toBe(cursor);
            expect(cursor.duration(0.1)).toBe(cursor);
            expect(cursor.staccato()).toBe(cursor);
        });

        it('modifies state', () => {
            cursor.velocity(0.42);
            expect((cursor as any)._velocity).toBe(0.42);

            cursor.legato();
            expect((cursor as any)._duration).toBe(1.0);
        });
    });

    describe('Commit Logic', () => {
        it('_commit() calls commit() if pending', () => {
            cursor.hasPending = true;
            cursor._commit();
            expect(cursor.commitCalls).toBe(1);
            expect(cursor.hasPending).toBe(false);
        });

        it('_commit() does NOT call commit() if not pending', () => {
            cursor.hasPending = false;
            cursor._commit();
            expect(cursor.commitCalls).toBe(0);
        });
    });

    describe('Escapes', () => {
        it('rest() commits and calls clip.rest', () => {
            cursor.hasPending = true;
            const res = cursor.rest(0.5);

            expect(cursor.commitCalls).toBe(1);
            expect(clip.rest).toHaveBeenCalledWith(0.5);
            expect(res).toBe(clip);
        });

        it('tempo() commits and calls clip.tempo', () => {
            cursor.hasPending = true;
            cursor.tempo(120);
            expect(cursor.commitCalls).toBe(1);
            expect(clip.tempo).toHaveBeenCalledWith(120);
        });

        it('popState() commits pending note before clip.popState', () => {
            cursor.hasPending = true;
            const res = cursor.popState();

            expect(cursor.commitCalls).toBe(1);
            expect(clip.popState).toHaveBeenCalledTimes(1);
            expect(res).toBe(clip);
        });
    });
});
