import { Track } from '../Track';
import type { ClipNode, ClipBuilder } from '../types';
import { SCHEMA_VERSION } from '../types';

/**
 * Create a minimal ClipNode for testing.
 */
function createTestClipNode(name: string = 'test-clip'): ClipNode {
    return {
        _version: SCHEMA_VERSION,
        kind: 'clip',
        name,
        operations: [],
        tempo: 120,
        timeSignature: [4, 4],
        swing: 0.5,
        groove: null
    };
}

/**
 * Create a mock ClipBuilder for testing.
 */
function createTestClipBuilder(name: string = 'builder-clip'): ClipBuilder {
    return {
        build(): ClipNode {
            return createTestClipNode(name);
        }
    };
}

describe('Track', () => {
    describe('Track.from()', () => {
        it('should create Track from ClipNode and instrument', () => {
            const clip = createTestClipNode();
            const track = Track.from(clip, 'piano');

            expect(track).toBeInstanceOf(Track);
        });

        it('should create Track from ClipBuilder and instrument', () => {
            const builder = createTestClipBuilder();
            const track = Track.from(builder, 'synth');

            expect(track).toBeInstanceOf(Track);
        });

        it('should accept optional name in options', () => {
            const clip = createTestClipNode();
            const track = Track.from(clip, 'piano', { name: 'Lead Piano' });

            const node = track.build();
            expect(node.name).toBe('Lead Piano');
        });

        it('should throw if instrument is empty', () => {
            const clip = createTestClipNode();

            expect(() => Track.from(clip, '')).toThrow('instrument must be a non-empty string');
        });

        it('should throw if clip is null', () => {
            expect(() => Track.from(null as any, 'piano')).toThrow('clip is required');
        });

        it('should throw if clip is undefined', () => {
            expect(() => Track.from(undefined as any, 'piano')).toThrow('clip is required');
        });
    });

    describe('tempo()', () => {
        it('should set tempo and return this for chaining', () => {
            const clip = createTestClipNode();
            const track = Track.from(clip, 'piano');

            const result = track.tempo(120);

            expect(result).toBe(track);
        });

        it('should store tempo in built node', () => {
            const clip = createTestClipNode();
            const node = Track.from(clip, 'piano')
                .tempo(140)
                .build();

            expect(node.tempo).toBe(140);
        });

        it('should throw for non-positive tempo', () => {
            const track = Track.from(createTestClipNode(), 'piano');

            expect(() => track.tempo(0)).toThrow('must be a positive number');
            expect(() => track.tempo(-100)).toThrow('must be a positive number');
        });

        it('should throw for non-finite tempo', () => {
            const track = Track.from(createTestClipNode(), 'piano');

            expect(() => track.tempo(NaN)).toThrow('must be a positive number');
            expect(() => track.tempo(Infinity)).toThrow('must be a positive number');
        });
    });

    describe('timeSignature()', () => {
        it('should set time signature and return this for chaining', () => {
            const clip = createTestClipNode();
            const track = Track.from(clip, 'piano');

            const result = track.timeSignature(4, 4);

            expect(result).toBe(track);
        });

        it('should store time signature in built node', () => {
            const clip = createTestClipNode();
            const node = Track.from(clip, 'piano')
                .timeSignature(3, 4)
                .build();

            expect(node.timeSignature).toEqual([3, 4]);
        });

        it('should accept various valid time signatures', () => {
            const clip = createTestClipNode();

            expect(Track.from(clip, 'p').timeSignature(4, 4).build().timeSignature).toEqual([4, 4]);
            expect(Track.from(clip, 'p').timeSignature(3, 4).build().timeSignature).toEqual([3, 4]);
            expect(Track.from(clip, 'p').timeSignature(6, 8).build().timeSignature).toEqual([6, 8]);
            expect(Track.from(clip, 'p').timeSignature(2, 2).build().timeSignature).toEqual([2, 2]);
            expect(Track.from(clip, 'p').timeSignature(5, 4).build().timeSignature).toEqual([5, 4]);
            expect(Track.from(clip, 'p').timeSignature(7, 8).build().timeSignature).toEqual([7, 8]);
            expect(Track.from(clip, 'p').timeSignature(12, 16).build().timeSignature).toEqual([12, 16]);
        });

        it('should throw for non-positive numerator', () => {
            const track = Track.from(createTestClipNode(), 'piano');

            expect(() => track.timeSignature(0, 4)).toThrow('numerator must be a positive integer');
            expect(() => track.timeSignature(-4, 4)).toThrow('numerator must be a positive integer');
        });

        it('should throw for non-integer numerator', () => {
            const track = Track.from(createTestClipNode(), 'piano');

            expect(() => track.timeSignature(4.5, 4)).toThrow('numerator must be a positive integer');
        });

        it('should throw for non-power-of-2 denominator', () => {
            const track = Track.from(createTestClipNode(), 'piano');

            expect(() => track.timeSignature(4, 3)).toThrow('denominator must be a power of 2');
            expect(() => track.timeSignature(4, 5)).toThrow('denominator must be a power of 2');
            expect(() => track.timeSignature(4, 6)).toThrow('denominator must be a power of 2');
        });
    });

    describe('insert()', () => {
        it('should add insert effect and return this for chaining', () => {
            const clip = createTestClipNode();
            const track = Track.from(clip, 'piano');

            const result = track.insert('reverb', { roomSize: 0.5 });

            expect(result).toBe(track);
        });

        it('should store reverb effect in built node', () => {
            const clip = createTestClipNode();
            const node = Track.from(clip, 'piano')
                .insert('reverb', { roomSize: 0.5, decay: 2 })
                .build();

            expect(node.inserts).toHaveLength(1);
            expect(node.inserts[0].type).toBe('reverb');
            expect(node.inserts[0].params).toEqual({ roomSize: 0.5, decay: 2 });
        });

        it('should support multiple insert effects', () => {
            const clip = createTestClipNode();
            const node = Track.from(clip, 'piano')
                .insert('reverb', { roomSize: 0.3 })
                .insert('delay', { time: 0.5, feedback: 0.4 })
                .insert('compressor', { threshold: -20, ratio: 4 })
                .build();

            expect(node.inserts).toHaveLength(3);
            expect(node.inserts[0].type).toBe('reverb');
            expect(node.inserts[1].type).toBe('delay');
            expect(node.inserts[2].type).toBe('compressor');
        });

        it('should support all effect types', () => {
            const clip = createTestClipNode();
            const node = Track.from(clip, 'piano')
                .insert('reverb', {})
                .insert('delay', {})
                .insert('chorus', {})
                .insert('distortion', {})
                .insert('compressor', {})
                .insert('eq', {})
                .insert('filter', {})
                .insert('custom', { myParam: 42 })
                .build();

            expect(node.inserts).toHaveLength(8);
        });

        it('should throw for invalid effect type', () => {
            const track = Track.from(createTestClipNode(), 'piano');

            expect(() => track.insert('phaser' as any, {})).toThrow('invalid effect type');
            expect(() => track.insert('' as any, {})).toThrow('invalid effect type');
        });
    });

    describe('send()', () => {
        it('should add send config and return this for chaining', () => {
            const clip = createTestClipNode();
            const track = Track.from(clip, 'piano');

            const result = track.send('delay-bus', 0.5);

            expect(result).toBe(track);
        });

        it('should store send config in built node', () => {
            const clip = createTestClipNode();
            const node = Track.from(clip, 'piano')
                .send('reverb-bus', 0.3)
                .build();

            expect(node.sends).toHaveLength(1);
            expect(node.sends[0].bus).toBe('reverb-bus');
            expect(node.sends[0].amount).toBe(0.3);
        });

        it('should support multiple sends', () => {
            const clip = createTestClipNode();
            const node = Track.from(clip, 'piano')
                .send('reverb-bus', 0.3)
                .send('delay-bus', 0.5)
                .send('chorus-bus', 0.2)
                .build();

            expect(node.sends).toHaveLength(3);
            expect(node.sends[0].bus).toBe('reverb-bus');
            expect(node.sends[1].bus).toBe('delay-bus');
            expect(node.sends[2].bus).toBe('chorus-bus');
        });

        it('should accept boundary amounts (0 and 1)', () => {
            const clip = createTestClipNode();
            const node = Track.from(clip, 'piano')
                .send('bus-a', 0)
                .send('bus-b', 1)
                .build();

            expect(node.sends[0].amount).toBe(0);
            expect(node.sends[1].amount).toBe(1);
        });

        it('should throw for empty bus name', () => {
            const track = Track.from(createTestClipNode(), 'piano');

            expect(() => track.send('', 0.5)).toThrow('invalid bus');
        });

        it('should throw for amount out of range', () => {
            const track = Track.from(createTestClipNode(), 'piano');

            expect(() => track.send('bus', -0.1)).toThrow('invalid bus');
            expect(() => track.send('bus', 1.1)).toThrow('invalid bus');
        });
    });

    describe('build()', () => {
        it('should return valid TrackNode structure', () => {
            const clip = createTestClipNode('my-clip');
            const node = Track.from(clip, 'piano', { name: 'My Track' }).build();

            expect(node._version).toBe(SCHEMA_VERSION);
            expect(node.kind).toBe('track');
            expect(node.name).toBe('My Track');
            expect(node.instrumentId).toBe('piano');
            expect(node.clip.kind).toBe('clip');
            expect(node.clip.name).toBe('my-clip');
            expect(node.inserts).toEqual([]);
            expect(node.sends).toEqual([]);
        });

        it('should resolve ClipBuilder to ClipNode', () => {
            const builder = createTestClipBuilder('built-clip');
            const node = Track.from(builder, 'synth').build();

            expect(node.clip.kind).toBe('clip');
            expect(node.clip.name).toBe('built-clip');
        });

        it('should use ClipNode directly when passed', () => {
            const clipNode = createTestClipNode('direct-clip');
            const node = Track.from(clipNode, 'piano').build();

            expect(node.clip).toEqual(clipNode);
        });

        it('should include all configured properties', () => {
            const clip = createTestClipNode();
            const node = Track.from(clip, 'piano', { name: 'Full Track' })
                .tempo(140)
                .timeSignature(3, 4)
                .insert('reverb', { roomSize: 0.5 })
                .insert('delay', { time: 0.25 })
                .send('bus-a', 0.3)
                .send('bus-b', 0.7)
                .build();

            expect(node.name).toBe('Full Track');
            expect(node.instrumentId).toBe('piano');
            expect(node.tempo).toBe(140);
            expect(node.timeSignature).toEqual([3, 4]);
            expect(node.inserts).toHaveLength(2);
            expect(node.sends).toHaveLength(2);
        });

        it('should return undefined for tempo/timeSignature if not set', () => {
            const clip = createTestClipNode();
            const node = Track.from(clip, 'piano').build();

            expect(node.tempo).toBeUndefined();
            expect(node.timeSignature).toBeUndefined();
        });

        it('should return empty arrays for inserts/sends if none added', () => {
            const clip = createTestClipNode();
            const node = Track.from(clip, 'piano').build();

            expect(node.inserts).toEqual([]);
            expect(node.sends).toEqual([]);
        });
    });

    describe('method chaining', () => {
        it('should support full fluent chaining', () => {
            const clip = createTestClipNode();

            const node = Track.from(clip, 'piano', { name: 'Chained' })
                .tempo(120)
                .timeSignature(4, 4)
                .insert('reverb', { roomSize: 0.3 })
                .insert('compressor', { threshold: -10, ratio: 3 })
                .send('delay-bus', 0.5)
                .send('reverb-bus', 0.4)
                .build();

            expect(node.name).toBe('Chained');
            expect(node.tempo).toBe(120);
            expect(node.timeSignature).toEqual([4, 4]);
            expect(node.inserts).toHaveLength(2);
            expect(node.sends).toHaveLength(2);
        });

        it('should allow multiple builds from same track', () => {
            const clip = createTestClipNode();
            const track = Track.from(clip, 'piano').tempo(120);

            const node1 = track.build();
            const node2 = track.build();

            expect(node1).toEqual(node2);
            expect(node1).not.toBe(node2); // Different object references
        });
    });

    describe('immutability', () => {
        it('should create independent copies of inserts array', () => {
            const clip = createTestClipNode();
            const track = Track.from(clip, 'piano').insert('reverb', { roomSize: 0.5 });

            const node1 = track.build();
            const node2 = track.build();

            expect(node1.inserts).not.toBe(node2.inserts);
            expect(node1.inserts).toEqual(node2.inserts);
        });

        it('should create independent copies of sends array', () => {
            const clip = createTestClipNode();
            const track = Track.from(clip, 'piano').send('bus', 0.5);

            const node1 = track.build();
            const node2 = track.build();

            expect(node1.sends).not.toBe(node2.sends);
            expect(node1.sends).toEqual(node2.sends);
        });
    });
});
