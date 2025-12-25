/**
 * SymphonyScript - Phase-Locked Scheduler
 *
 * Provides pure mathematical utilities for phase-locked timing.
 * Per RFC-047 Phase 3 final directive: Keep Kernel theory-agnostic and flat.
 */
/**
 * Calculate phase-locked time for loop-based synchronization.
 *
 * Logic:
 * - If cycle is Infinity or 0: Returns absolute tick (no looping).
 * - Otherwise: Returns tick % cycle.
 *
 * This ensures "Time % LoopLength" synchronization, ignoring history,
 * allowing instant re-sync for live coding adjustments.
 *
 * @param tick - Absolute tick position
 * @param cycle - Cycle length in ticks (or Infinity)
 * @returns Phase-locked tick position (0 to cycle-1)
 */
export declare function getModulatedTime(tick: number, cycle: number): number;
//# sourceMappingURL=scheduler.d.ts.map