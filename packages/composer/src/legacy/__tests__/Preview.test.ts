import { SynapticMelody } from '../clips/SynapticMelody'
import { SynapticDrums } from '../clips/SynapticDrums'
import { Clip } from '../Clip'
import { createTestBridge } from '../test-bridge'

describe('Preview (Task 037)', () => {
    let mockBridge: ReturnType<typeof createTestBridge>;
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
        mockBridge = createTestBridge();
        consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    describe('SynapticClip.preview()', () => {
        it('returns this for chaining', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note('C4', 0.5).commit();
            const result = melody.preview();
            expect(result).toBe(melody);
        });

        it('uses default BPM of 120', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.name('Test').note('C4', 0.5).commit();
            melody.preview();

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('120 BPM'));
        });

        it('accepts custom BPM', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.name('Test').note('C4', 0.5).commit();
            melody.preview(90);

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('90 BPM'));
        });

        it('shows clip name', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.name('MyMelody').note('C4', 0.5).commit();
            melody.preview();

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Clip: MyMelody'));
        });
    });

    describe('Empty clip', () => {
        it('shows (empty) for clip with no notes', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.name('Empty');
            melody.preview();

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Clip: Empty'));
            expect(consoleSpy).toHaveBeenCalledWith('(empty)');
        });
    });

    describe('Grid format', () => {
        it('shows beat header', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note('C4', 0.5).commit();
            melody.preview();

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Beat:'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('|1---2---3---4---|'));
        });

        it('shows pitch names', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note('C4', 0.5).commit();
            melody.preview();

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('C4'));
        });

        it('shows X for note onset', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note('C4', 0.25).commit();
            melody.preview();

            // Find the pitch row call
            const calls = consoleSpy.mock.calls.map(c => c[0]);
            const pitchRow = calls.find(c => typeof c === 'string' && c.includes('C4'));
            expect(pitchRow).toContain('X');
        });

        it('shows - for sustained notes', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note('C4', 1).commit(); // 1 beat = 4 16th notes
            melody.preview();

            const calls = consoleSpy.mock.calls.map(c => c[0]);
            const pitchRow = calls.find(c => typeof c === 'string' && c.includes('C4'));
            expect(pitchRow).toMatch(/X-{3}/); // X followed by 3 sustain marks
        });
    });

    describe('Multiple pitches', () => {
        it('sorts pitches high to low', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note('C4', 0.25).commit();
            melody.advanceTick(0.25);
            melody.note('E4', 0.25).commit();
            melody.advanceTick(0.25);
            melody.note('G4', 0.25).commit();
            melody.preview();

            const calls = consoleSpy.mock.calls.map(c => c[0]);
            const pitchRows = calls.filter(c => typeof c === 'string' && /^[A-G]/.test(c));

            // G4 should come before E4 which should come before C4
            const g4Index = pitchRows.findIndex(r => r.includes('G4'));
            const e4Index = pitchRows.findIndex(r => r.includes('E4'));
            const c4Index = pitchRows.findIndex(r => r.includes('C4'));

            expect(g4Index).toBeLessThan(e4Index);
            expect(e4Index).toBeLessThan(c4Index);
        });

        it('shows multiple notes at different positions', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note('C4', 0.25).commit();
            melody.advanceTick(1); // 1 beat later
            melody.note('C4', 0.25).commit();
            melody.preview();

            const calls = consoleSpy.mock.calls.map(c => c[0]);
            const pitchRow = calls.find(c => typeof c === 'string' && c.includes('C4'));

            // Should have two X marks
            const xCount = (pitchRow?.match(/X/g) || []).length;
            expect(xCount).toBe(2);
        });
    });

    describe('Multiple bars', () => {
        it('shows multiple bars for long clips', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note('C4', 0.25).commit();
            melody.advanceTick(4); // Move to bar 2
            melody.note('C4', 0.25).commit();
            melody.preview();

            const calls = consoleSpy.mock.calls.map(c => c[0]);
            const beatHeader = calls.find(c => typeof c === 'string' && c.includes('Beat:'));

            // Should have at least 2 bar markers
            const barCount = (beatHeader?.match(/\|1---2---3---4---\|/g) || []).length;
            expect(barCount).toBeGreaterThanOrEqual(2);
        });
    });

    describe('Pitch name conversion', () => {
        it('converts MIDI 60 to C4', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note(60, 0.25).commit();
            melody.preview();

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('C4'));
        });

        it('converts MIDI 69 to A4', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note(69, 0.25).commit();
            melody.preview();

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('A4'));
        });

        it('handles sharps', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note('C#4', 0.25).commit();
            melody.preview();

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('C#4'));
        });
    });

    describe('Clip factory integration', () => {
        it('Clip.melody().preview() works', () => {
            const melody = Clip.melody('test');
            melody.note('C4', 0.5).commit();
            melody.preview();

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Clip: test'));
        });
    });

    describe('Chaining', () => {
        it('can chain after preview', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note('C4', 0.5).commit();
            melody.preview();
            melody.advanceTick(0.5);
            melody.note('D4', 0.5).commit();

            const result = melody.build();
            expect(result.operations.filter(op => op.kind === 'note')).toHaveLength(2);
        });
    });

    describe('SynapticDrums', () => {
        it('preview works on drum clips', () => {
            const drums = new SynapticDrums(mockBridge);
            drums.name('Drums').kick(0.25).commit();
            drums.preview();

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Clip: Drums'));
            // Drums use MIDI note 36 for kick (C2)
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('C2'));
        });
    });

    describe('Edge cases', () => {
        it('handles very short notes', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note('C4', 0.0625).commit(); // 1/64th note
            melody.preview();

            const calls = consoleSpy.mock.calls.map(c => c[0]);
            const pitchRow = calls.find(c => typeof c === 'string' && c.includes('C4'));
            expect(pitchRow).toContain('X');
        });

        it('handles notes starting mid-beat', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.advanceTick(0.5); // Start at beat 1.5
            melody.note('C4', 0.25).commit();
            melody.preview();

            const calls = consoleSpy.mock.calls.map(c => c[0]);
            const pitchRow = calls.find(c => typeof c === 'string' && c.includes('C4'));
            // X should not be at position 0
            expect(pitchRow).toMatch(/\.\.X/);
        });

        it('handles overlapping notes on same pitch', () => {
            const melody = new SynapticMelody(mockBridge);
            melody.note('C4', 1).commit();
            melody.advanceTick(0.5);
            melody.note('C4', 1).commit();
            melody.preview();

            const calls = consoleSpy.mock.calls.map(c => c[0]);
            const pitchRow = calls.find(c => typeof c === 'string' && c.includes('C4'));
            // Should have two X marks
            const xCount = (pitchRow?.match(/X/g) || []).length;
            expect(xCount).toBe(2);
        });
    });
});
