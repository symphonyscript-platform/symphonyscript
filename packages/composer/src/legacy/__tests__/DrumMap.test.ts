/**
 * DrumMap Tests - Task 040
 * Tests custom drum mapping functionality for SynapticDrums.
 */

import { Clip } from '../Clip'
import { DrumType, NoteOperation } from '../types'

describe('DrumMap (Task 040)', () => {
    describe('Default GM Mapping', () => {
        it('kick() uses default GM pitch (36)', () => {
            const drums = Clip.drums('test');
            drums.kick().commit();
            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].pitch).toBe(36);
        });

        it('snare() uses default GM pitch (38)', () => {
            const drums = Clip.drums('test');
            drums.snare().commit();
            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].pitch).toBe(38);
        });

        it('hat() uses default GM pitch (42)', () => {
            const drums = Clip.drums('test');
            drums.hat().commit();
            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].pitch).toBe(42);
        });

        it('openHat() uses default GM pitch (46)', () => {
            const drums = Clip.drums('test');
            drums.openHat().commit();
            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].pitch).toBe(46);
        });

        it('crash() uses default GM pitch (49)', () => {
            const drums = Clip.drums('test');
            drums.crash().commit();
            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].pitch).toBe(49);
        });

        it('ride() uses default GM pitch (51)', () => {
            const drums = Clip.drums('test');
            drums.ride().commit();
            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].pitch).toBe(51);
        });

        it('clap() uses default GM pitch (39)', () => {
            const drums = Clip.drums('test');
            drums.clap().commit();
            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].pitch).toBe(39);
        });

        it('tom(1) uses default GM pitch (48)', () => {
            const drums = Clip.drums('test');
            drums.tom(1).commit();
            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].pitch).toBe(48);
        });

        it('tom(2) uses default GM pitch (45)', () => {
            const drums = Clip.drums('test');
            drums.tom(2).commit();
            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].pitch).toBe(45);
        });

        it('tom(3) uses default GM pitch (43)', () => {
            const drums = Clip.drums('test');
            drums.tom(3).commit();
            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].pitch).toBe(43);
        });
    });

    describe('hit() with drum names', () => {
        it('hit("kick") resolves to kick pitch', () => {
            const drums = Clip.drums('test');
            drums.hit('kick').commit();
            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].pitch).toBe(36);
        });

        it('hit("snare") resolves to snare pitch', () => {
            const drums = Clip.drums('test');
            drums.hit('snare').commit();
            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].pitch).toBe(38);
        });

        it('hit() with numeric pitch passes through', () => {
            const drums = Clip.drums('test');
            drums.hit(60).commit(); // Middle C
            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].pitch).toBe(60);
        });

        it('hit() with note name falls back to parsePitch', () => {
            const drums = Clip.drums('test');
            drums.hit('C4').commit(); // Middle C
            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].pitch).toBe(60);
        });

        it('hit() is case-insensitive for drum names', () => {
            const drums = Clip.drums('test');
            drums.hit('KICK').commit();
            drums.hit('Snare').commit();
            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(2);
            expect(noteOps[0].pitch).toBe(36);
            expect(noteOps[1].pitch).toBe(38);
        });
    });

    describe('mapDrum()', () => {
        it('overrides existing drum sounds', () => {
            const drums = Clip.drums('test')
                .mapDrum(DrumType.KICK, 48);
            drums.kick().commit();
            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].pitch).toBe(48);
        });

        it('supports all DrumType values', () => {
            const drums = Clip.drums('test')
                .mapDrum(DrumType.KICK, 48)
                .mapDrum(DrumType.SNARE, 50)
                .mapDrum(DrumType.HAT, 52)
                .mapDrum(DrumType.CLAP, 54)
                .mapDrum(DrumType.TOM, 55);

            drums.kick().commit();
            drums.snare().commit();
            drums.hat().commit();
            drums.clap().commit();
            drums.tom(1).commit();

            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(5);
            expect(noteOps[0].pitch).toBe(48);
            expect(noteOps[1].pitch).toBe(50);
            expect(noteOps[2].pitch).toBe(52);
            expect(noteOps[3].pitch).toBe(54);
            expect(noteOps[4].pitch).toBe(55);
        });

        it('returns this for chaining', () => {
            const drums = Clip.drums('test');
            const result = drums.mapDrum(DrumType.KICK, 50);
            expect(result).toBe(drums);
        });

        it('applies multiple overrides', () => {
            const drums = Clip.drums('test')
                .mapDrum(DrumType.KICK, 50)
                .mapDrum(DrumType.SNARE, 60);

            drums.kick().commit();
            drums.snare().commit();

            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(2);
            expect(noteOps[0].pitch).toBe(50);
            expect(noteOps[1].pitch).toBe(60);
        });

        it('later mappings override earlier ones', () => {
            const drums = Clip.drums('test')
                .mapDrum(DrumType.KICK, 50)
                .mapDrum(DrumType.KICK, 70);

            drums.kick().commit();

            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].pitch).toBe(70);
        });

        it('preserves non-overridden defaults', () => {
            const drums = Clip.drums('test')
                .mapDrum(DrumType.KICK, 56);

            drums.kick().commit();
            drums.snare().commit();

            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(2);
            expect(noteOps[0].pitch).toBe(56);
            expect(noteOps[1].pitch).toBe(38);
        });
    });

    describe('resolveDrumPitch()', () => {
        it('resolves mapped drum names', () => {
            const drums = Clip.drums('test');
            expect(drums.resolveDrumPitch('kick')).toBe(36);
            expect(drums.resolveDrumPitch('snare')).toBe(38);
            expect(drums.resolveDrumPitch('hat')).toBe(42);
        });

        it('passes through numeric values', () => {
            const drums = Clip.drums('test');
            expect(drums.resolveDrumPitch(60)).toBe(60);
            expect(drums.resolveDrumPitch(127)).toBe(127);
        });

        it('falls back to parsePitch for unknown names', () => {
            const drums = Clip.drums('test');
            expect(drums.resolveDrumPitch('C4')).toBe(60);
            expect(drums.resolveDrumPitch('A4')).toBe(69);
        });

        it('is case-insensitive', () => {
            const drums = Clip.drums('test');
            expect(drums.resolveDrumPitch('KICK')).toBe(36);
            expect(drums.resolveDrumPitch('Kick')).toBe(36);
            expect(drums.resolveDrumPitch('kIcK')).toBe(36);
        });
    });

    describe('Integration with euclidean()', () => {
        it('euclidean uses mapDrum overrides', () => {
            const drums = Clip.drums('test')
                .mapDrum(DrumType.KICK, 48);

            drums.euclidean({
                hits: 2,
                steps: 4,
                drum: DrumType.KICK,
                stepDuration: 0.25,
            });
            
            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(2);
            expect(noteOps[0].pitch).toBe(48); // Custom kick
            expect(noteOps[1].pitch).toBe(48);
        });
    });

    describe('Chaining', () => {
        it('mapDrum chains with drum methods', () => {
            const drums = Clip.drums('test')
                .mapDrum(DrumType.KICK, 56);

            drums.kick().commit();

            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].pitch).toBe(56);
        });

        it('mapDrum chains with tempo()', () => {
            const drums = Clip.drums('test')
                .mapDrum(DrumType.KICK, 50)
                .tempo(140);

            drums.kick().commit();

            const node = drums.build();
            expect(node.tempo).toBe(140);
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].pitch).toBe(50);
        });

        it('full pattern with overridden standard mapping', () => {
            const drums = Clip.drums('beat')
                .mapDrum(DrumType.KICK, 36)
                .mapDrum(DrumType.SNARE, 38)
                .mapDrum(DrumType.HAT, 42)
                .tempo(120);

            // Simple 4-on-floor pattern
            drums.kick().commit();
            drums.hat().commit();
            drums.snare().commit();
            drums.hat().commit();

            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(4);
            expect(noteOps[0].pitch).toBe(36);  // kick
            expect(noteOps[1].pitch).toBe(42);  // hat
            expect(noteOps[2].pitch).toBe(38);  // snare
            expect(noteOps[3].pitch).toBe(42);  // hat
        });
    });

    describe('Edge Cases', () => {
        it('single mapDrum call does not break non-overridden defaults', () => {
            const drums = Clip.drums('test')
                .mapDrum(DrumType.KICK, 50);
            drums.kick().commit();
            drums.snare().commit();
            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(2);
            expect(noteOps[0].pitch).toBe(50);
            expect(noteOps[1].pitch).toBe(38);
        });

        it('throws for invalid pitch name', () => {
            const drums = Clip.drums('test');
            expect(() => drums.hit('invalid_not_a_note').commit()).toThrow();
        });
    });
});
