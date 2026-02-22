/**
 * DegreeChord Tests - Task 041
 * Tests scale-degree-based chord creation for SynapticMelody.
 */

import { Clip } from '../Clip';
import { NoteOperation, ScaleMode } from '../types';

describe('DegreeChord (Task 041)', () => {
    describe('Basic Functionality', () => {
        it('creates a triad from degrees [1, 3, 5] in C major', () => {
            const melody = Clip.melody('test')
                .setScale('C', ScaleMode.MAJOR);
            
            melody.degreeChord([1, 3, 5]).commit();
            
            const node = melody.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            
            // C major triad: C4, E4, G4 (60, 64, 67)
            expect(noteOps).toHaveLength(3);
            const pitches = noteOps.map(op => op.pitch).sort((a, b) => a - b);
            expect(pitches).toEqual([60, 64, 67]);
        });

        it('creates a minor triad from degrees [1, 3, 5] in A minor', () => {
            const melody = Clip.melody('test')
                .setScale('A', ScaleMode.MINOR);
            
            melody.degreeChord([1, 3, 5]).commit();
            
            const node = melody.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            
            // A minor triad: A4, C5, E5 (69, 72, 76)
            expect(noteOps).toHaveLength(3);
            const pitches = noteOps.map(op => op.pitch).sort((a, b) => a - b);
            expect(pitches).toEqual([69, 72, 76]);
        });

        it('creates a 7th chord from degrees [1, 3, 5, 7]', () => {
            const melody = Clip.melody('test')
                .setScale('C', ScaleMode.MAJOR);
            
            melody.degreeChord([1, 3, 5, 7]).commit();
            
            const node = melody.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            
            // C major 7th: C4, E4, G4, B4 (60, 64, 67, 71)
            expect(noteOps).toHaveLength(4);
            const pitches = noteOps.map(op => op.pitch).sort((a, b) => a - b);
            expect(pitches).toEqual([60, 64, 67, 71]);
        });

        it('creates a sus4 chord from degrees [1, 4, 5]', () => {
            const melody = Clip.melody('test')
                .setScale('C', ScaleMode.MAJOR);
            
            melody.degreeChord([1, 4, 5]).commit();
            
            const node = melody.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            
            // C sus4: C4, F4, G4 (60, 65, 67)
            expect(noteOps).toHaveLength(3);
            const pitches = noteOps.map(op => op.pitch).sort((a, b) => a - b);
            expect(pitches).toEqual([60, 65, 67]);
        });
    });

    describe('Scale Modes', () => {
        it('works with dorian mode', () => {
            const melody = Clip.melody('test')
                .setScale('D', ScaleMode.DORIAN);
            
            melody.degreeChord([1, 3, 5]).commit();
            
            const node = melody.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            
            // D dorian triad: D4, F4, A4 (62, 65, 69)
            expect(noteOps).toHaveLength(3);
            const pitches = noteOps.map(op => op.pitch).sort((a, b) => a - b);
            expect(pitches).toEqual([62, 65, 69]);
        });

        it('works with phrygian mode', () => {
            const melody = Clip.melody('test')
                .setScale('E', ScaleMode.PHRYGIAN);
            
            melody.degreeChord([1, 3, 5]).commit();
            
            const node = melody.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            
            // E phrygian triad: E4, G4, B4 (64, 67, 71)
            expect(noteOps).toHaveLength(3);
            const pitches = noteOps.map(op => op.pitch).sort((a, b) => a - b);
            expect(pitches).toEqual([64, 67, 71]);
        });

        it('works with lydian mode', () => {
            const melody = Clip.melody('test')
                .setScale('F', ScaleMode.LYDIAN);
            
            melody.degreeChord([1, 3, 5]).commit();
            
            const node = melody.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            
            // F lydian triad: F4, A4, C5 (65, 69, 72)
            expect(noteOps).toHaveLength(3);
            const pitches = noteOps.map(op => op.pitch).sort((a, b) => a - b);
            expect(pitches).toEqual([65, 69, 72]);
        });

        it('works with mixolydian mode', () => {
            const melody = Clip.melody('test')
                .setScale('G', ScaleMode.MIXOLYDIAN);
            
            melody.degreeChord([1, 3, 5]).commit();
            
            const node = melody.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            
            // G mixolydian triad: G4, B4, D5 (67, 71, 74)
            expect(noteOps).toHaveLength(3);
            const pitches = noteOps.map(op => op.pitch).sort((a, b) => a - b);
            expect(pitches).toEqual([67, 71, 74]);
        });

        it('works with locrian mode', () => {
            const melody = Clip.melody('test')
                .setScale('B', ScaleMode.LOCRIAN);
            
            melody.degreeChord([1, 3, 5]).commit();
            
            const node = melody.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            
            // B locrian triad: B4, D5, F5 (71, 74, 77)
            expect(noteOps).toHaveLength(3);
            const pitches = noteOps.map(op => op.pitch).sort((a, b) => a - b);
            expect(pitches).toEqual([71, 74, 77]);
        });
    });

    describe('Octave Handling', () => {
        it('handles degrees above 7 (octave wrap)', () => {
            const melody = Clip.melody('test')
                .setScale('C', ScaleMode.MAJOR);
            
            // Degrees 8, 10, 12 = 1, 3, 5 one octave up
            melody.degreeChord([8, 10, 12]).commit();
            
            const node = melody.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            
            // C5, E5, G5 (72, 76, 79)
            expect(noteOps).toHaveLength(3);
            const pitches = noteOps.map(op => op.pitch).sort((a, b) => a - b);
            expect(pitches).toEqual([72, 76, 79]);
        });

        it('handles mixed octave degrees', () => {
            const melody = Clip.melody('test')
                .setScale('C', ScaleMode.MAJOR);
            
            // Root in base octave, 3rd and 5th one octave up
            melody.degreeChord([1, 10, 12]).commit();
            
            const node = melody.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            
            // C4, E5, G5 (60, 76, 79)
            expect(noteOps).toHaveLength(3);
            const pitches = noteOps.map(op => op.pitch).sort((a, b) => a - b);
            expect(pitches).toEqual([60, 76, 79]);
        });
    });

    describe('Duration', () => {
        it('applies duration to all chord notes', () => {
            const melody = Clip.melody('test')
                .setScale('C', ScaleMode.MAJOR);
            
            melody.degreeChord([1, 3, 5], 2).commit();
            
            const node = melody.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            
            expect(noteOps).toHaveLength(3);
            expect(noteOps[0].duration).toBe(2);
            expect(noteOps[1].duration).toBe(2);
            expect(noteOps[2].duration).toBe(2);
        });

        it('uses cursor default duration when not specified', () => {
            const melody = Clip.melody('test')
                .setScale('C', ScaleMode.MAJOR);
            
            melody.degreeChord([1, 3, 5]).commit();
            
            const node = melody.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            
            expect(noteOps).toHaveLength(3);
            // Chord cursor has default duration of 0.25
            expect(noteOps[0].duration).toBe(0.25);
        });
    });

    describe('Error Handling', () => {
        it('throws when setScale() not called first', () => {
            const melody = Clip.melody('test');
            
            expect(() => melody.degreeChord([1, 3, 5])).toThrow(
                'degreeChord() requires scale() to be called first'
            );
        });

        it('throws for empty degrees array', () => {
            const melody = Clip.melody('test')
                .setScale('C', ScaleMode.MAJOR);
            
            expect(() => melody.degreeChord([])).toThrow(
                'degreeChord() requires at least one degree'
            );
        });
    });

    describe('Chaining', () => {
        it('returns SynapticChordCursor for chaining', () => {
            const melody = Clip.melody('test')
                .setScale('C', ScaleMode.MAJOR);
            
            const cursor = melody.degreeChord([1, 3, 5]);
            
            // Should have chord cursor methods
            expect(typeof cursor.velocity).toBe('function');
            expect(typeof cursor.duration).toBe('function');
            expect(typeof cursor.commit).toBe('function');
        });

        it('chains with velocity modifier', () => {
            const melody = Clip.melody('test')
                .setScale('C', ScaleMode.MAJOR);
            
            melody.degreeChord([1, 3, 5]).velocity(0.5).commit();
            
            const node = melody.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            
            expect(noteOps).toHaveLength(3);
            // Velocity is stored as 0-127 scaled value
            expect(noteOps[0].velocity).toBeGreaterThan(50);
            expect(noteOps[0].velocity).toBeLessThan(70);
        });

        it('chains multiple degree chords', () => {
            const melody = Clip.melody('test')
                .setScale('C', ScaleMode.MAJOR);
            
            // I - IV - V - I progression
            melody.degreeChord([1, 3, 5], 1).commit();
            melody.advanceTick(1);
            melody.degreeChord([4, 6, 8], 1).commit();
            melody.advanceTick(1);
            melody.degreeChord([5, 7, 9], 1).commit();
            melody.advanceTick(1);
            melody.degreeChord([1, 3, 5], 1).commit();
            
            const node = melody.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            
            // 4 chords × 3 notes = 12 notes
            expect(noteOps).toHaveLength(12);
        });
    });

    describe('Integration', () => {
        it('works with tempo and time signature', () => {
            const melody = Clip.melody('test')
                .tempo(140)
                .timeSignature(3, 4)
                .setScale('G', ScaleMode.MAJOR);
            
            melody.degreeChord([1, 3, 5]).commit();
            
            const node = melody.build();
            expect(node.tempo).toBe(140);
            expect(node.timeSignature).toEqual([3, 4]);
            
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            expect(noteOps).toHaveLength(3);
        });

        it('works alongside regular notes', () => {
            const melody = Clip.melody('test')
                .setScale('C', ScaleMode.MAJOR);
            
            melody.note('C4', 0.5).commit();
            melody.advanceTick(0.5);
            melody.degreeChord([1, 3, 5], 1).commit();
            
            const node = melody.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            
            // 1 single note + 3 chord notes = 4 notes
            expect(noteOps).toHaveLength(4);
        });

        it('works with degree() single notes', () => {
            const melody = Clip.melody('test')
                .setScale('C', ScaleMode.MAJOR);
            
            melody.degree(1, 0.5).commit();
            melody.advanceTick(0.5);
            melody.degreeChord([1, 3, 5], 1).commit();
            
            const node = melody.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            
            // 1 single note + 3 chord notes = 4 notes
            expect(noteOps).toHaveLength(4);
            
            // First note should be C4 (degree 1)
            expect(noteOps[0].pitch).toBe(60);
        });
    });

    describe('Secondary Chords', () => {
        it('creates ii chord (degrees 2, 4, 6) in C major', () => {
            const melody = Clip.melody('test')
                .setScale('C', ScaleMode.MAJOR);
            
            melody.degreeChord([2, 4, 6]).commit();
            
            const node = melody.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            
            // D minor triad: D4, F4, A4 (62, 65, 69)
            expect(noteOps).toHaveLength(3);
            const pitches = noteOps.map(op => op.pitch).sort((a, b) => a - b);
            expect(pitches).toEqual([62, 65, 69]);
        });

        it('creates iii chord (degrees 3, 5, 7) in C major', () => {
            const melody = Clip.melody('test')
                .setScale('C', ScaleMode.MAJOR);
            
            melody.degreeChord([3, 5, 7]).commit();
            
            const node = melody.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            
            // E minor triad: E4, G4, B4 (64, 67, 71)
            expect(noteOps).toHaveLength(3);
            const pitches = noteOps.map(op => op.pitch).sort((a, b) => a - b);
            expect(pitches).toEqual([64, 67, 71]);
        });

        it('creates vi chord (degrees 6, 8, 10) in C major', () => {
            const melody = Clip.melody('test')
                .setScale('C', ScaleMode.MAJOR);
            
            melody.degreeChord([6, 8, 10]).commit();
            
            const node = melody.build();
            const noteOps = node.operations.filter(op => op.kind === 'note') as NoteOperation[];
            
            // A minor triad: A4, C5, E5 (69, 72, 76)
            expect(noteOps).toHaveLength(3);
            const pitches = noteOps.map(op => op.pitch).sort((a, b) => a - b);
            expect(pitches).toEqual([69, 72, 76]);
        });
    });
});
