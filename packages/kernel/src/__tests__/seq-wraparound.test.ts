// =============================================================================
// SymphonyScript - Task 071: SEQ Counter Wraparound Tests
// =============================================================================

import {
  SiliconSynapse,
  seqChanged,
  NULL_PTR,
  NODE,
  OPCODE,
  FLAG,
  SEQ,
  unpackPitch
} from '../index'

// =============================================================================
// Helper Functions
// =============================================================================

function createTestLinker(nodeCapacity = 64): SiliconSynapse {
  const linker = SiliconSynapse.create({ nodeCapacity, safeZoneTicks: 0 })!
  linker.setAudioContext(true)
  return linker
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
// Integration: readNodeRaw still works with seqChanged
// =============================================================================

describe('readNodeRaw with seqChanged integration', () => {
  const buf = new Int32Array(8)

  it('reads node data correctly (no contention)', () => {
    const linker = createTestLinker()
    const ptr = linker.insertHead(...noteData(60, 0))
    expect(ptr).not.toBe(NULL_PTR)

    const success = linker.readNodeRaw(ptr, buf)

    expect(success).toBe(true)
    expect(unpackPitch(buf[NODE.PACKED_A])).toBe(60)
  })

  it('returns false for NULL_PTR', () => {
    const linker = createTestLinker()
    const success = linker.readNodeRaw(NULL_PTR, buf)
    expect(success).toBe(false)
  })

  it('reads consistent data after patch', () => {
    const linker = createTestLinker()
    const ptr = linker.insertHead(...noteData(60, 0))

    linker.patchPitch(ptr, 72)

    linker.readNodeRaw(ptr, buf)

    expect(unpackPitch(buf[NODE.PACKED_A])).toBe(72)
  })
})

// =============================================================================
// Integration: readNodeRaw traversal still works with seqChanged
// =============================================================================

describe('readNodeRaw traversal with seqChanged integration', () => {
  const buf = new Int32Array(8)

  it('traverses all nodes correctly via while loop', () => {
    const linker = createTestLinker()
    linker.insertHead(...noteData(60, 0))
    linker.insertHead(...noteData(64, 480))
    linker.insertHead(...noteData(67, 960))

    const pitches: number[] = []
    let ptr = linker.getHead()
    while (ptr !== NULL_PTR) {
      const ok = linker.readNodeRaw(ptr, buf)
      if (ok) {
        pitches.push(unpackPitch(buf[NODE.PACKED_A]))
      }
      ptr = buf[NODE.NEXT_PTR]
    }

    expect(pitches).toHaveLength(3)
    expect(pitches).toContain(60)
    expect(pitches).toContain(64)
    expect(pitches).toContain(67)
  })

  it('empty chain yields no iterations', () => {
    const linker = createTestLinker()
    let count = 0
    let ptr = linker.getHead()
    while (ptr !== NULL_PTR) {
      linker.readNodeRaw(ptr, buf)
      count = count + 1
      ptr = buf[NODE.NEXT_PTR]
    }
    expect(count).toBe(0)
  })
})
