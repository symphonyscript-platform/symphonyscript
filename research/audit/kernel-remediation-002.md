# Kernel Remediation Plan (v2.0 Candidate)

**Date**: 2025-12-30
**Refers To**: `kernel-audit-001.md`
**Author**: Antigravity

## Overview
This document outlines the proposed remediation strategies for issues identified in the Kernel Package Comprehensive Audit (001). The focus is on preparing the kernel for v2.0 scalability and efficiency.

## Remediation Strategies

### K-001: SynapseAllocator Memory Overhead (MEDIUM)
**Issue**: ~1.5MB of redundant `Int32Array` staging buffers due to dual instantiation in Main/Worker threads.
**Fix**: Class Separation (Reader/Writer Split).
- **Why**: Strict zero-allocation policy requires avoiding *any* runtime allocation logic, even lazy. Splitting the class enforces "Function follows Data".
- **Proposed Change**:
  - `SynapseView`: Read-only, allocation-free. Used by `SiliconBridge`.
  - `SynapseManager extends SynapseView`: Adds `alloc()`, `free()`, and `compact()`. Used by `SiliconSynapse`.
  - Staging buffers are allocated strictly in `SynapseManager` constructor.
- **Impact**: Zero waste. Main Thread gets a slim view. Worker gets the heavy machinery.

### K-002: Synapse Table Scalability (MEDIUM)
**Issue**: Hardcoded 65,536 Synapse Capacity limits Brain size.
**Fix**: Hybrid Dynamic Sizing.
- **Why**: "Brain" size should scale with Node count, but power users need manual control. Ratio 8:1 covers 99% of use cases.
- **Proposed Change**:
  - **HDR Update**: Add `HDR.SYNAPSE_CAPACITY` and `HDR.SYNAPSE_COUNT` to SAB Header.
  - **Default**: `synapseCapacity = nodeCapacity * 8`.
  - **Config**: Allow explicit `synapseCapacity` in `LinkerConfig`.
  - **Logic**: `SiliconSynapse` reads capacity from HDR, not constant.
- **Impact**: Scales linearly by default, fully customizable for power users. Minimal runtime cost.

### K-003: Zone B Initialization (LOW)
**Issue**: Zone B memory relies on implicit zeroing.
**Fix**: Lazy Zero-on-Alloc ("Clean as you Go").
- **Mechanism**: `LocalAllocator.alloc()` explicitly zeros the node before returning it. `FreeList.initialize` does nothing for Zone B.
- **Why**: Distributed cost (no startup spike), zero-trust robustness (immune to init bugs), better cache locality.

### K-004: Hashing Divergence (LOW)
**Issue**: Inconsistent hashing between `SiliconBridge` and Kernel.
**Fix**: Unify Hash Function.
- **Mechanism**: Port Knuth Multiplicative Hash logic to `SiliconBridge.generateSourceId`.
- **Why**: Consistency is kind. We prioritize architectural purity over backwards compatibility.

### K-005: LocalAllocator Finite Lifespan (HIGH)
**Issue**: Bump-pointer exhaustion limits session length.
**Fix**: Reclaim Ring + Local Free List (v2.0).
- **Mechanism**:
  1. Main Thread `deleteAsync(ptr)`.
  2. Worker processes delete, then writes `ptr` to new `RECLAIM_RING`.
  3. Main Thread polls `RECLAIM_RING`, adds `ptr` to `LocalFreeList` (Int32Array stack).
  4. `LocalAllocator` prefers `LocalFreeList` over bump pointer.
- **Mandate**: Must use **Zero-on-Alloc** to ensure reclaimed nodes are scrubbed of old data before reuse.
- **Why**: Option A (Reclaim Ring) is the only glitch-free solution.
- **Components**: New `RECLAIM_RING` (64KB), `LocalFreeList` implementation.

## Implementation Roadmap

1. **Immediate (v1.6)**:
   - Implement **K-001** (Lazy Staging).
   - Implement **K-003** (Explicit Zeroing).
   - Implement **K-004** (Hash Unification).

2. **v2.0 (Breaking)**:
   - Implement **K-002** (Dynamic Tables) - changes SAB layout.
   - Implement **K-005** (Zone B Reclamation/Defrag).
