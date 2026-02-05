import { Session } from '../Session';
import { Track } from '../Track';
import type { ClipNode, ClipBuilder, TrackNode } from '../types';
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

/**
 * Create a test TrackNode.
 */
function createTestTrackNode(name: string = 'test-track'): TrackNode {
    return {
        _version: SCHEMA_VERSION,
        kind: 'track',
        name,
        instrumentId: 'piano',
        clip: createTestClipNode(),
        tempo: 120,
        timeSignature: [4, 4],
        inserts: [],
        sends: []
    };
}

describe('Session', () => {
    describe('Session.create()', () => {
        it('should create Session instance', () => {
            const session = Session.create();

            expect(session).toBeInstanceOf(Session);
        });

        it('should accept optional name in options', () => {
            const session = Session.create({ name: 'My Song' });

            const node = session.build();
            expect(node.name).toBe('My Song');
        });

        it('should default name to empty string', () => {
            const session = Session.create();

            const node = session.build();
            expect(node.name).toBe('');
        });
    });

    describe('tempo()', () => {
        it('should set tempo and return this for chaining', () => {
            const session = Session.create();

            const result = session.tempo(120);

            expect(result).toBe(session);
        });

        it('should store tempo in built node', () => {
            const node = Session.create()
                .tempo(140)
                .build();

            expect(node.tempo).toBe(140);
        });

        it('should throw for non-positive tempo', () => {
            const session = Session.create();

            expect(() => session.tempo(0)).toThrow('must be a positive number');
            expect(() => session.tempo(-100)).toThrow('must be a positive number');
        });

        it('should throw for non-finite tempo', () => {
            const session = Session.create();

            expect(() => session.tempo(NaN)).toThrow('must be a positive number');
            expect(() => session.tempo(Infinity)).toThrow('must be a positive number');
        });
    });

    describe('timeSignature()', () => {
        it('should set time signature and return this for chaining', () => {
            const session = Session.create();

            const result = session.timeSignature(4, 4);

            expect(result).toBe(session);
        });

        it('should store time signature in built node', () => {
            const node = Session.create()
                .timeSignature(3, 4)
                .build();

            expect(node.timeSignature).toEqual([3, 4]);
        });

        it('should accept various valid time signatures', () => {
            expect(Session.create().timeSignature(4, 4).build().timeSignature).toEqual([4, 4]);
            expect(Session.create().timeSignature(3, 4).build().timeSignature).toEqual([3, 4]);
            expect(Session.create().timeSignature(6, 8).build().timeSignature).toEqual([6, 8]);
            expect(Session.create().timeSignature(2, 2).build().timeSignature).toEqual([2, 2]);
            expect(Session.create().timeSignature(5, 4).build().timeSignature).toEqual([5, 4]);
        });

        it('should throw for non-positive numerator', () => {
            const session = Session.create();

            expect(() => session.timeSignature(0, 4)).toThrow('numerator must be a positive integer');
            expect(() => session.timeSignature(-4, 4)).toThrow('numerator must be a positive integer');
        });

        it('should throw for non-power-of-2 denominator', () => {
            const session = Session.create();

            expect(() => session.timeSignature(4, 3)).toThrow('denominator must be a power of 2');
            expect(() => session.timeSignature(4, 5)).toThrow('denominator must be a power of 2');
        });
    });

    describe('add()', () => {
        it('should add Track instance and return this for chaining', () => {
            const session = Session.create();
            const track = Track.from(createTestClipNode(), 'piano');

            const result = session.add(track);

            expect(result).toBe(session);
        });

        it('should add TrackNode and return this for chaining', () => {
            const session = Session.create();
            const trackNode = createTestTrackNode();

            const result = session.add(trackNode);

            expect(result).toBe(session);
        });

        it('should store Track in built node', () => {
            const track = Track.from(createTestClipNode(), 'piano', { name: 'Lead' });
            const node = Session.create()
                .add(track)
                .build();

            expect(node.tracks).toHaveLength(1);
            expect(node.tracks[0].name).toBe('Lead');
            expect(node.tracks[0].instrumentId).toBe('piano');
        });

        it('should store TrackNode directly', () => {
            const trackNode = createTestTrackNode('Direct Track');
            const node = Session.create()
                .add(trackNode)
                .build();

            expect(node.tracks).toHaveLength(1);
            expect(node.tracks[0].name).toBe('Direct Track');
        });

        it('should support multiple tracks', () => {
            const track1 = Track.from(createTestClipNode(), 'piano', { name: 'Track 1' });
            const track2 = Track.from(createTestClipNode(), 'bass', { name: 'Track 2' });
            const trackNode = createTestTrackNode('Track 3');

            const node = Session.create()
                .add(track1)
                .add(track2)
                .add(trackNode)
                .build();

            expect(node.tracks).toHaveLength(3);
            expect(node.tracks[0].name).toBe('Track 1');
            expect(node.tracks[1].name).toBe('Track 2');
            expect(node.tracks[2].name).toBe('Track 3');
        });

        it('should throw if track is null', () => {
            const session = Session.create();

            expect(() => session.add(null as any)).toThrow('track is required');
        });

        it('should throw if track is undefined', () => {
            const session = Session.create();

            expect(() => session.add(undefined as any)).toThrow('track is required');
        });
    });

    describe('track()', () => {
        it('should create and add track inline', () => {
            const clip = createTestClipNode();
            const node = Session.create()
                .track('Lead', clip, 'piano')
                .build();

            expect(node.tracks).toHaveLength(1);
            expect(node.tracks[0].name).toBe('Lead');
            expect(node.tracks[0].instrumentId).toBe('piano');
        });

        it('should return this for chaining', () => {
            const session = Session.create();
            const clip = createTestClipNode();

            const result = session.track('Lead', clip, 'piano');

            expect(result).toBe(session);
        });

        it('should accept ClipBuilder', () => {
            const builder = createTestClipBuilder('built-clip');
            const node = Session.create()
                .track('Lead', builder, 'piano')
                .build();

            expect(node.tracks).toHaveLength(1);
            expect(node.tracks[0].clip.name).toBe('built-clip');
        });

        it('should support multiple inline tracks', () => {
            const clip = createTestClipNode();
            const node = Session.create()
                .track('Lead', clip, 'piano')
                .track('Bass', clip, 'bass')
                .track('Drums', clip, 'drums')
                .build();

            expect(node.tracks).toHaveLength(3);
            expect(node.tracks[0].name).toBe('Lead');
            expect(node.tracks[1].name).toBe('Bass');
            expect(node.tracks[2].name).toBe('Drums');
        });

        it('should throw if clip is null', () => {
            const session = Session.create();

            expect(() => session.track('Lead', null as any, 'piano')).toThrow('clip is required');
        });

        it('should throw if instrument is empty', () => {
            const session = Session.create();
            const clip = createTestClipNode();

            expect(() => session.track('Lead', clip, '')).toThrow('instrument must be a non-empty string');
        });
    });

    describe('bus()', () => {
        it('should define effect bus and return this for chaining', () => {
            const session = Session.create();

            const result = session.bus('reverb-bus', 'reverb', { roomSize: 0.5 });

            expect(result).toBe(session);
        });

        it('should store bus config in built node', () => {
            const node = Session.create()
                .bus('reverb-bus', 'reverb', { roomSize: 0.5, decay: 2 })
                .build();

            expect(node.buses).toHaveLength(1);
            expect(node.buses[0].name).toBe('reverb-bus');
            expect(node.buses[0].effects).toHaveLength(1);
            expect(node.buses[0].effects[0].type).toBe('reverb');
            expect(node.buses[0].effects[0].params).toEqual({ roomSize: 0.5, decay: 2 });
        });

        it('should support multiple buses', () => {
            const node = Session.create()
                .bus('reverb-bus', 'reverb', { roomSize: 0.3 })
                .bus('delay-bus', 'delay', { time: 0.5, feedback: 0.4 })
                .bus('chorus-bus', 'chorus', { rate: 1.5, depth: 0.5 })
                .build();

            expect(node.buses).toHaveLength(3);
            expect(node.buses[0].name).toBe('reverb-bus');
            expect(node.buses[1].name).toBe('delay-bus');
            expect(node.buses[2].name).toBe('chorus-bus');
        });

        it('should support all effect types', () => {
            const node = Session.create()
                .bus('b1', 'reverb', {})
                .bus('b2', 'delay', {})
                .bus('b3', 'chorus', {})
                .bus('b4', 'distortion', {})
                .bus('b5', 'compressor', {})
                .bus('b6', 'eq', {})
                .bus('b7', 'filter', {})
                .bus('b8', 'custom', { myParam: 42 })
                .build();

            expect(node.buses).toHaveLength(8);
        });

        it('should throw for empty bus id', () => {
            const session = Session.create();

            expect(() => session.bus('', 'reverb', {})).toThrow('id must be a non-empty string');
        });

        it('should throw for invalid effect type', () => {
            const session = Session.create();

            expect(() => session.bus('bus', 'phaser' as any, {})).toThrow('invalid effect type');
        });
    });

    describe('build()', () => {
        it('should return valid SessionNode structure', () => {
            const node = Session.create({ name: 'My Session' }).build();

            expect(node._version).toBe(SCHEMA_VERSION);
            expect(node.kind).toBe('session');
            expect(node.name).toBe('My Session');
            expect(node.tracks).toEqual([]);
            expect(node.buses).toEqual([]);
        });

        it('should include all configured properties', () => {
            const clip = createTestClipNode();
            const node = Session.create({ name: 'Full Session' })
                .tempo(140)
                .timeSignature(3, 4)
                .track('Lead', clip, 'piano')
                .track('Bass', clip, 'bass')
                .bus('reverb-bus', 'reverb', { roomSize: 0.5 })
                .bus('delay-bus', 'delay', { time: 0.25 })
                .build();

            expect(node.name).toBe('Full Session');
            expect(node.tempo).toBe(140);
            expect(node.timeSignature).toEqual([3, 4]);
            expect(node.tracks).toHaveLength(2);
            expect(node.buses).toHaveLength(2);
        });

        it('should return undefined for tempo/timeSignature if not set', () => {
            const node = Session.create().build();

            expect(node.tempo).toBeUndefined();
            expect(node.timeSignature).toBeUndefined();
        });

        it('should return empty arrays for tracks/buses if none added', () => {
            const node = Session.create().build();

            expect(node.tracks).toEqual([]);
            expect(node.buses).toEqual([]);
        });
    });

    describe('method chaining', () => {
        it('should support full fluent chaining', () => {
            const clip = createTestClipNode();
            const track = Track.from(clip, 'synth', { name: 'Synth Track' });

            const node = Session.create({ name: 'Chained' })
                .tempo(120)
                .timeSignature(4, 4)
                .add(track)
                .track('Lead', clip, 'piano')
                .bus('reverb-bus', 'reverb', { roomSize: 0.3 })
                .build();

            expect(node.name).toBe('Chained');
            expect(node.tempo).toBe(120);
            expect(node.timeSignature).toEqual([4, 4]);
            expect(node.tracks).toHaveLength(2);
            expect(node.buses).toHaveLength(1);
        });

        it('should allow multiple builds from same session', () => {
            const session = Session.create({ name: 'Multi' }).tempo(120);

            const node1 = session.build();
            const node2 = session.build();

            expect(node1).toEqual(node2);
            expect(node1).not.toBe(node2); // Different object references
        });
    });

    describe('immutability', () => {
        it('should create independent copies of tracks array', () => {
            const clip = createTestClipNode();
            const session = Session.create().track('Lead', clip, 'piano');

            const node1 = session.build();
            const node2 = session.build();

            expect(node1.tracks).not.toBe(node2.tracks);
            expect(node1.tracks).toEqual(node2.tracks);
        });

        it('should create independent copies of buses array', () => {
            const session = Session.create().bus('bus', 'reverb', {});

            const node1 = session.build();
            const node2 = session.build();

            expect(node1.buses).not.toBe(node2.buses);
            expect(node1.buses).toEqual(node2.buses);
        });
    });

    describe('integration', () => {
        it('should work with Track.from() and send to session bus', () => {
            const clip = createTestClipNode();
            const track = Track.from(clip, 'piano', { name: 'Piano' })
                .send('reverb-bus', 0.5);

            const node = Session.create({ name: 'Integration Test' })
                .tempo(120)
                .add(track)
                .bus('reverb-bus', 'reverb', { roomSize: 0.5 })
                .build();

            expect(node.tracks).toHaveLength(1);
            expect(node.tracks[0].sends).toHaveLength(1);
            expect(node.tracks[0].sends[0].bus).toBe('reverb-bus');
            expect(node.buses).toHaveLength(1);
            expect(node.buses[0].name).toBe('reverb-bus');
        });
    });
});
