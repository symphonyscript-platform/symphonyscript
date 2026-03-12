/**
 * Task 058: Global test setup.
 * Runtime clips no longer materialize operations arrays. Tests that still assert
 * operation-level behavior use this compatibility shim over test bridges only.
 */
import { initSession } from '../Clip';
import { createTestBridge } from '../test-bridge';
import { SynapticClip } from '../clips/SynapticClip';
import { SynapticCursor } from '../cursors/SynapticCursor';
import { FrozenClip } from '../clips/FrozenClip';
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

    Object.defineProperty(FrozenClip.prototype, 'clipNode', {
        configurable: true,
        enumerable: true,
        get: function frozenClipNodePatched(this: FrozenClip): ClipNode {
            const frozen = this as any;
            const source = frozen.source as SynapticClip;
            return {
                _version: 1,
                kind: 'clip',
                name: frozen.name ?? source.getClipName(),
                operations: typeof frozen.visitNotes === 'function'
                    ? (() => {
                        const ops: ClipNode['operations'] = [];
                        frozen.visitNotes((sourceId: number, pitch: number, velocity: number, duration: number, tick: number, muted: boolean, expressionId?: number) => {
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
                    })()
                    : noteSnapshot(source),
                tempo: undefined,
                timeSignature: undefined,
                swing: undefined,
                groove: undefined
            };
        }
    });

    (FrozenClip.prototype as any).toOperations = function frozenToOperationsPatched(this: FrozenClip): ClipNode['operations'] {
        const frozen = this as any;
        if (typeof frozen.visitNotes === 'function') {
            const ops: ClipNode['operations'] = [];
            frozen.visitNotes((sourceId: number, pitch: number, velocity: number, duration: number, tick: number, muted: boolean, expressionId?: number) => {
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
        const source = frozen.source as SynapticClip;
        return noteSnapshot(source);
    };

    patched = true;
}

beforeEach(() => {
    initSession(createTestBridge());
});
