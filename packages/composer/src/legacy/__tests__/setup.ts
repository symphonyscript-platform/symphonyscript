/**
 * Task 058: Global test setup.
 * Runtime clips no longer materialize operations arrays. Tests that still assert
 * operation-level behavior use this compatibility shim over test bridges only.
 */
import { initSession } from '../Clip';
import { createTestBridge } from '../test-bridge';
import { SynapticClip } from '../clips/SynapticClip';
import { SynapticCursor } from '../cursors/SynapticCursor';
import { ClipNode } from '../types';

const originalBuild = SynapticClip.prototype.build;
const originalToOperations = SynapticClip.prototype.toOperations;
let patched = false;

function noteSnapshot(clip: SynapticClip): ClipNode['operations'] {
    const ops: ClipNode['operations'] = [];
    clip.visitKernelNotes((sourceId, pitch, velocity, duration, tick, muted, expressionId) => {
        ops.push({
            kind: 'note',
            pitch,
            velocity,
            duration,
            tick,
            muted,
            sourceId,
            ...(expressionId !== undefined && expressionId !== 0 ? { expressionId } : {})
        });
    });
    return ops;
}

if (!patched) {
    SynapticClip.prototype.build = function buildPatched(this: SynapticClip): ClipNode {
        const node = originalBuild.call(this);
        return {
            ...node,
            operations: noteSnapshot(this)
        };
    };

    SynapticClip.prototype.toOperations = function toOperationsPatched(this: SynapticClip): ClipNode['operations'] {
        return noteSnapshot(this);
    };

    SynapticCursor.prototype.build = function cursorBuildPatched(this: SynapticCursor): ClipNode {
        this._commit();
        return (this as any).clip.build();
    };

    SynapticCursor.prototype.toOperations = function cursorToOperationsPatched(this: SynapticCursor): ClipNode['operations'] {
        this._commit();
        return (this as any).clip.toOperations();
    };

    patched = true;
}

beforeEach(() => {
    initSession(createTestBridge());
});
