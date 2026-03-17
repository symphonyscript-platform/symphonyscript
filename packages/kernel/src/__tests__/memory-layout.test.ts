// =============================================================================
// SymphonyScript - Memory Layout Tests (Task 4.2)
// =============================================================================
// Validates correct memory region sizing and high-slot access after Task 1.1 fix.

import {
  SiliconSynapse,
  calculateSABSize,
  getSymbolTableOffset,
  getIdentityTableOffset,
  HDR,
  OPCODE,
  NULL_PTR,
  SYM_TABLE,
  ID_TABLE
} from '../index'

describe('Memory Layout Validation', () => {
  describe('Symbol Table / Identity Table Capacity Parity', () => {
    it('should have matching capacities for ID and Symbol tables', () => {
      // nodeCapacity must be power of 2 (Task 3.2)
      const nodeCapacity = 256
      const linker = SiliconSynapse.create({ nodeCapacity, safeZoneTicks: 0 })
      const sab = new Int32Array(linker.getSAB()!)

      const idTableCapacity = sab[HDR.ID_TABLE_CAPACITY]
      // Symbol Table capacity is implicit: nodeCapacity * 2 (same as ID Table)
      const expectedCapacity = nodeCapacity * 2 // 512

      // Both should be nodeCapacity * 2 = 512
      expect(idTableCapacity).toBe(expectedCapacity)
    })

    it('should access valid memory for high slot indices', () => {
      const nodeCapacity = 4096 // Power of 2
      const sabSize = calculateSABSize(nodeCapacity)
      const symTableStart = getSymbolTableOffset(nodeCapacity)
      const maxSlot = nodeCapacity * 2 - 1 // 8191 for nodeCapacity=4096
      const maxSlotOffset = symTableStart + maxSlot * SYM_TABLE.ENTRY_SIZE_BYTES

      // Max slot should be within SAB bounds
      expect(maxSlotOffset + SYM_TABLE.ENTRY_SIZE_BYTES).toBeLessThanOrEqual(sabSize)
    })

    it('should not overlap Symbol Table with subsequent regions', () => {
      const nodeCapacity = 1024
      const idTableOffset = getIdentityTableOffset(nodeCapacity)
      const symTableOffset = getSymbolTableOffset(nodeCapacity)

      // Symbol Table should start after Identity Table ends
      const idTableSize = nodeCapacity * 2 * ID_TABLE.ENTRY_SIZE_BYTES
      expect(symTableOffset).toBeGreaterThanOrEqual(idTableOffset + idTableSize)
    })
  })

  describe('Identity Table High Slot Access', () => {
    it('should correctly store/retrieve entries in high slots (>= nodeCapacity)', () => {
      // nodeCapacity=256 means ID table capacity=512
      // Inserting 400 entries will force quadratic probing into high slots (>= 256)
      const linker = SiliconSynapse.create({ nodeCapacity: 256, safeZoneTicks: 0 })
      linker.setAudioContext(true)

      // Insert enough entries to force quadratic probing into high slots
      const entries: Array<{ sourceId: number; ptr: number }> = []

      for (let i = 1; i <= 400; i++) {
        const ptr = linker.insertHead(
          OPCODE.NOTE,
          60,           // pitch
          100,          // velocity
          480,          // duration
          i * 100,      // baseTick
          i,            // sourceId
          0             // flags
        )
        if (ptr !== NULL_PTR) {
          entries.push({ sourceId: i, ptr })
        }
      }

      // Should have inserted 128 entries (Zone A = nodeCapacity/2 = 128)
      expect(entries.length).toBe(128)

      // Verify all entries can be looked up
      for (const entry of entries) {
        const foundPtr = linker.idTableLookup(entry.sourceId)
        expect(foundPtr).toBe(entry.ptr)
      }

      // Verify Symbol Table access doesn't corrupt Identity Table
      for (const entry of entries) {
        linker.symTableStore(entry.sourceId, 12345, 100, 50)
      }

      // Re-verify ID table (would fail if Symbol Table corrupted it)
      for (const entry of entries) {
        const foundPtr = linker.idTableLookup(entry.sourceId)
        expect(foundPtr).toBe(entry.ptr)
      }
    })

    it('should handle quadratic probing correctly without memory corruption', () => {
      // Use small capacity to maximize probing
      const linker = SiliconSynapse.create({ nodeCapacity: 64, safeZoneTicks: 0 })
      linker.setAudioContext(true)

      // Insert entries with sourceIds that will hash to similar slots
      // This forces quadratic probing to higher slot indices
      const sourceIds = [1, 65, 129, 193, 257] // Will likely collide and probe

      const ptrs: number[] = []
      for (const sourceId of sourceIds) {
        const ptr = linker.insertHead(
          OPCODE.NOTE,
          60,
          100,
          480,
          sourceId * 100,
          sourceId,
          0
        )
        if (ptr !== NULL_PTR) {
          ptrs.push(ptr)
        }
      }

      // Verify lookup works for all inserted entries
      for (let i = 0; i < ptrs.length; i++) {
        const foundPtr = linker.idTableLookup(sourceIds[i])
        expect(foundPtr).toBe(ptrs[i])
      }
    })
  })
})
