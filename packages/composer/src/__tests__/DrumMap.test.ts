/**
 * DrumMap Tests - Task 040
 * Tests custom drum mapping functionality for SynapticDrums.
 */

import { Clip } from '../Clip';
import { NoteOperation } from '../types';

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

    describe('withMapping()', () => {
        it('overrides existing drum sounds', () => {
            const drums = Clip.drums('test').withMapping({
                'kick': 48,  // Override kick to MIDI 48
            });
            drums.kick().commit();
            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].pitch).toBe(48);
        });

        it('adds new custom drum sounds', () => {
            const drums = Clip.drums('test').withMapping({
                'cowbell': 56,  // Add cowbell at MIDI 56
            });
            drums.hit('cowbell').commit();
            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].pitch).toBe(56);
        });

        it('accepts numeric pitch values in mapping', () => {
            const drums = Clip.drums('test').withMapping({
                'custom': 100,  // Direct MIDI number
            });
            drums.hit('custom').commit();
            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].pitch).toBe(100);
        });

        it('returns this for chaining', () => {
            const drums = Clip.drums('test');
            const result = drums.withMapping({ 'custom': 50 });
            expect(result).toBe(drums);
        });

        it('merges multiple mappings', () => {
            const drums = Clip.drums('test')
                .withMapping({ 'custom1': 50 })
                .withMapping({ 'custom2': 60 });
            
            drums.hit('custom1').commit();
            drums.hit('custom2').commit();
            
            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(2);
            expect(noteOps[0].pitch).toBe(50);
            expect(noteOps[1].pitch).toBe(60);
        });

        it('later mappings override earlier ones', () => {
            const drums = Clip.drums('test')
                .withMapping({ 'custom': 50 })
                .withMapping({ 'custom': 70 });
            
            drums.hit('custom').commit();
            
            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].pitch).toBe(70);
        });

        it('preserves default sounds when adding custom', () => {
            const drums = Clip.drums('test').withMapping({
                'cowbell': 56,  // MIDI 56
            });
            
            drums.kick().commit();  // Should still work
            drums.hit('cowbell').commit();
            
            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(2);
            expect(noteOps[0].pitch).toBe(36); // Default kick
            expect(noteOps[1].pitch).toBe(56); // Custom cowbell
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

        it('resolves custom mappings', () => {
            const drums = Clip.drums('test').withMapping({
                'cowbell': 56,  // MIDI 56
                'block': 77,
            });
            expect(drums.resolveDrumPitch('cowbell')).toBe(56);
            expect(drums.resolveDrumPitch('block')).toBe(77);
        });
    });

    describe('Integration with euclidean()', () => {
        it('euclidean uses custom mapping', () => {
            const drums = Clip.drums('test').withMapping({
                'kick': 48,  // Override to MIDI 48
            });
            
            drums.euclidean({
                hits: 2,
                steps: 4,
                drum: 'kick',
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
        it('withMapping chains with drum methods', () => {
            const drums = Clip.drums('test')
                .withMapping({ 'cowbell': 56 });
            
            drums.hit('cowbell').commit();
            
            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].pitch).toBe(56);
        });

        it('withMapping chains with tempo()', () => {
            const drums = Clip.drums('test')
                .withMapping({ 'custom': 50 })
                .tempo(140);
            
            drums.hit('custom').commit();
            
            const node = drums.build();
            expect(node.tempo).toBe(140);
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].pitch).toBe(50);
        });

        it('full pattern with custom mapping', () => {
            const drums = Clip.drums('beat')
                .withMapping({
                    'kick': 36,      // MIDI 36
                    'snare': 38,     // MIDI 38
                    'hat': 42,       // MIDI 42
                    'cowbell': 56,   // MIDI 56
                })
                .tempo(120);
            
            // Simple 4-on-floor pattern
            drums.kick().commit();
            drums.hat().commit();
            drums.snare().commit();
            drums.hat().commit();
            drums.hit('cowbell').commit();
            
            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(5);
            expect(noteOps[0].pitch).toBe(36);  // kick
            expect(noteOps[1].pitch).toBe(42);  // hat
            expect(noteOps[2].pitch).toBe(38);  // snare
            expect(noteOps[3].pitch).toBe(42);  // hat
            expect(noteOps[4].pitch).toBe(56);  // cowbell
        });
    });

    describe('Edge Cases', () => {
        it('empty mapping does not break defaults', () => {
            const drums = Clip.drums('test').withMapping({});
            drums.kick().commit();
            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(1);
            expect(noteOps[0].pitch).toBe(36);
        });

        it('throws for invalid pitch name', () => {
            const drums = Clip.drums('test');
            expect(() => drums.hit('invalid_not_a_note').commit()).toThrow();
        });

        it('handles special characters in custom names', () => {
            const drums = Clip.drums('test').withMapping({
                'kick-alt': 50,
                'snare_2': 51,
            });
            drums.hit('kick-alt').commit();
            drums.hit('snare_2').commit();
            const node = drums.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(2);
            expect(noteOps[0].pitch).toBe(50);
            expect(noteOps[1].pitch).toBe(51);
        });
    });
});
