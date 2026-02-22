import { SynapticDrums } from '../clips/SynapticDrums';
import { createTestBridge } from '../test-bridge';

// Matcher for optional params (afterSourceId, expressionId) which can be undefined or number
const optional = { asymmetricMatch: () => true };

describe('SynapticDrumHitCursor & SynapticDrums (Phase 3)', () => {
    let drums: SynapticDrums;
    let mockBridge: ReturnType<typeof createTestBridge>;

    beforeEach(() => {
        mockBridge = createTestBridge();
        drums = new SynapticDrums(mockBridge);
    });

    it('creates drum hits with correct pitches', () => {
        drums.kick().snare().hat().clap().commit();

        expect(mockBridge.insertAsync).toHaveBeenCalledTimes(4);

        // Kick (C1 = 36)
        expect(mockBridge.insertAsync).toHaveBeenNthCalledWith(
            1, 1, 36, expect.any(Number), expect.any(Number),
            expect.any(Number), expect.any(Boolean), expect.any(Number),
            optional, optional
        );

        // Snare (D1 = 38)
        expect(mockBridge.insertAsync).toHaveBeenNthCalledWith(
            2, 1, 38, expect.any(Number), expect.any(Number),
            expect.any(Number), expect.any(Boolean), expect.any(Number),
            optional, optional
        );
    });

    it('applies ghost modifier', () => {
        drums.kick().ghost().snare().commit();

        const ghostCall = mockBridge.insertAsync.mock.calls[1];
        const velocity = ghostCall[2];

        // Ghost note should have low velocity (~38 = 0.3 * 127)
        expect(velocity).toBeLessThan(50);
    });

    it('supports fluent chaining', () => {
        drums.kick().velocity(0.9).hat().velocity(0.5).commit();

        expect(mockBridge.insertAsync).toHaveBeenCalledTimes(2);
    });

    it('advances tick correctly', () => {
        drums.kick(0.25).snare(0.5).commit();

        // First kick at tick 0
        expect(mockBridge.insertAsync.mock.calls[0][4]).toBe(0);
        // Snare at tick 0.25
        expect(mockBridge.insertAsync.mock.calls[1][4]).toBe(0.25);
    });

    describe('Additional drum hits (Task 018)', () => {
        it('openHat() emits pitch 46', () => {
            drums.openHat().commit();

            expect(mockBridge.insertAsync).toHaveBeenCalledWith(
                1, 46, expect.any(Number), expect.any(Number),
                expect.any(Number), expect.any(Boolean), expect.any(Number),
                optional, optional
            );
        });

        it('crash() emits pitch 49', () => {
            drums.crash().commit();

            expect(mockBridge.insertAsync).toHaveBeenCalledWith(
                1, 49, expect.any(Number), expect.any(Number),
                expect.any(Number), expect.any(Boolean), expect.any(Number),
                optional, optional
            );
        });

        it('ride() emits pitch 51', () => {
            drums.ride().commit();

            expect(mockBridge.insertAsync).toHaveBeenCalledWith(
                1, 51, expect.any(Number), expect.any(Number),
                expect.any(Number), expect.any(Boolean), expect.any(Number),
                optional, optional
            );
        });

        it('tom(1) emits pitch 48', () => {
            drums.tom(1).commit();

            expect(mockBridge.insertAsync).toHaveBeenCalledWith(
                1, 48, expect.any(Number), expect.any(Number),
                expect.any(Number), expect.any(Boolean), expect.any(Number),
                optional, optional
            );
        });

        it('tom(2) emits pitch 45', () => {
            drums.tom(2).commit();

            expect(mockBridge.insertAsync).toHaveBeenCalledWith(
                1, 45, expect.any(Number), expect.any(Number),
                expect.any(Number), expect.any(Boolean), expect.any(Number),
                optional, optional
            );
        });

        it('tom(3) emits pitch 43', () => {
            drums.tom(3).commit();

            expect(mockBridge.insertAsync).toHaveBeenCalledWith(
                1, 43, expect.any(Number), expect.any(Number),
                expect.any(Number), expect.any(Boolean), expect.any(Number),
                optional, optional
            );
        });

        it('tom() defaults to tom(1)', () => {
            drums.tom().commit();

            expect(mockBridge.insertAsync).toHaveBeenCalledWith(
                1, 48, expect.any(Number), expect.any(Number),
                expect.any(Number), expect.any(Boolean), expect.any(Number),
                optional, optional
            );
        });

        it('cursor chaining works with new methods', () => {
            drums.kick().openHat().crash().ride().tom(1).commit();

            expect(mockBridge.insertAsync).toHaveBeenCalledTimes(5);
        });
    });
});
