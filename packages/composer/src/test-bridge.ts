/**
 * Task 058: Test bridge that implements traverseNotes by tracking insertAsync calls.
 * build() and toOperations() read from Kernel via traverseNotes; mocks must support it.
 */

import { SiliconBridge, OPCODE } from '@symphonyscript/kernel';

interface TrackedNote {
    sourceId: number;
    pitch: number;
    velocity: number;
    duration: number;
    baseTick: number;
    muted: boolean;
    expressionId?: number;
}

export function createTestBridge(): jest.Mocked<SiliconBridge> & { _notes: TrackedNote[] } {
    const notes: TrackedNote[] = [];
    const insertAsync = jest.fn().mockImplementation(
        (opcode: number, pitch: number, velocity: number, duration: number, baseTick: number, muted: boolean, sourceId: number, _afterSourceId?: number, expressionId?: number) => {
            if (opcode === OPCODE.NOTE) {
                notes.push({ sourceId, pitch, velocity, duration, baseTick, muted, expressionId });
            }
            return 0;
        }
    );
    const traverseNotes = jest.fn().mockImplementation((cb: (sourceId: number, pitch: number, velocity: number, duration: number, baseTick: number, muted: boolean, expressionId?: number) => void) => {
        notes.forEach(n => cb(n.sourceId, n.pitch, n.velocity, n.duration, n.baseTick, n.muted, n.expressionId));
    });
    return {
        insertAsync,
        traverseNotes,
        getLinker: () => ({ processCommands: () => {} }),
        _notes: notes
    } as any;
}
