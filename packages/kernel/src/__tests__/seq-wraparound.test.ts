// =============================================================================
// SymphonyScript - Task 071: SEQ Counter Wraparound Tests
// =============================================================================

import {
  SiliconSynapse,
  seqChanged,
  NULL_PTR,
  OPCODE,
  FLAG,
  SEQ
} from '../index'

// =============================================================================
// Helper Functions
// =============================================================================

function createTestLinker(nodeCapacity = 64): SiliconSynapse {
  return SiliconSynapse.create({ nodeCapacity, safeZoneTicks: 0 })!
}

function noteData(
  pitch: number,
  baseTick: number,
  duration = 96
): [number, number, number, number, number, number, number] {
  return [
    OPCODE.NOTE,
    pitch,
    100,
    duration,
    baseTick,
    pitch * 1000 + baseTick,
    FLAG.ACTIVE
  ]
}

// =============================================================================
// seqChanged() Unit Tests
// =============================================================================

describe('seqChanged — modular distance check', () => {
  it('returns false for identical values (consistent read)', () => {
    expect(seqChanged(5, 5)).toBe(false)
  })

  it('returns true when writer mutated during read (different values)', () => {
    expect(seqChanged(5, 6)).toBe(true)
  })

  it('returns true for normal increment near max', () => {
    expect(seqChanged(0xFFFFFE, 0xFFFFFF)).toBe(true)
  })

  it('returns true on wraparound (writer wrapped during read)', () => {
    expect(seqChanged(0xFFFFFF, 0x000000)).toBe(true)
  })

  it('returns false for zero/zero (same value, consistent)', () => {
    expect(seqChanged(0x000000, 0x000000)).toBe(false)
  })

  it('returns true for large forward distance', () => {
    expect(seqChanged(0, 0x7FFFFF)).toBe(true)
  })

  it('returns true when distance equals SEQ_HALF exactly', () => {
    // before === after but distance >= SEQ_HALF catches full half-cycle wrap
    // This case is: before !== after, so it returns true regardless
    expect(seqChanged(0, SEQ.SEQ_HALF)).toBe(true)
  })

  it('returns false for small same values across range', () => {
    expect(seqChanged(1000, 1000)).toBe(false)
    expect(seqChanged(0x800000, 0x800000)).toBe(false)
    expect(seqChanged(0xABCDEF, 0xABCDEF)).toBe(false)
  })

  it('returns true for any different values', () => {
    expect(seqChanged(0, 1)).toBe(true)
    expect(seqChanged(100, 101)).toBe(true)
    expect(seqChanged(0xFFFFFF, 0xFFFFFE)).toBe(true)
  })
})

// =============================================================================
// Integration: readNode still works with seqChanged
// =============================================================================

describe('readNode with seqChanged integration', () => {
  it('reads node data correctly (no contention)', () => {
    const linker = createTestLinker()
    const ptr = linker.insertHead(...noteData(60, 0))
    expect(ptr).not.toBe(NULL_PTR)

    let readPitch = -1
    let readVelocity = -1
    const success = linker.readNode(ptr, (_p, _op, pitch, velocity) => {
      readPitch = pitch
      readVelocity = velocity
    })

    expect(success).toBe(true)
    expect(readPitch).toBe(60)
    expect(readVelocity).toBe(100)
  })

  it('returns false for NULL_PTR', () => {
    const linker = createTestLinker()
    const success = linker.readNode(NULL_PTR, () => {})
    expect(success).toBe(false)
  })

  it('reads consistent data after patch', () => {
    const linker = createTestLinker()
    const ptr = linker.insertHead(...noteData(60, 0))

    linker.patchPitch(ptr, 72)

    let readPitch = -1
    linker.readNode(ptr, (_p, _op, pitch) => {
      readPitch = pitch
    })

    expect(readPitch).toBe(72)
  })
})

// =============================================================================
// Integration: traverse still works with seqChanged
// =============================================================================

describe('traverse with seqChanged integration', () => {
  it('traverses all nodes correctly', () => {
    const linker = createTestLinker()
    linker.insertHead(...noteData(60, 0))
    linker.insertHead(...noteData(64, 480))
    linker.insertHead(...noteData(67, 960))

    const pitches: number[] = []
    const success = linker.traverse((_ptr, _op, pitch) => {
      pitches.push(pitch)
    })

    expect(success).toBe(true)
    expect(pitches).toHaveLength(3)
    expect(pitches).toContain(60)
    expect(pitches).toContain(64)
    expect(pitches).toContain(67)
  })

  it('returns true for empty chain', () => {
    const linker = createTestLinker()
    const success = linker.traverse(() => {})
    expect(success).toBe(true)
  })
})
