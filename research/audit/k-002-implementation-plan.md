# K-002 Synapse Table Scalability Implementation Plan

## Goal Description
The current Kernel implementation uses a hardcoded Synapse Table capacity (likely implicit or fixed to 64k/16k). This limits the "Brain" size and doesn't scale with the number of Nodes.
K-002 aims to implement **Hybrid Dynamic Sizing**:
- `synapseCapacity` defaults to `nodeCapacity * 8`.
- `synapseCapacity` can be explicitly configured in `LinkerConfig`.
- The SAB size is calculated dynamically based on this capacity.
- `SiliconSynapse` and `SynapseAllocator` adapt to the runtime capacity stored in the Header.

## Proposed Changes

### [Kernel Package]

#### [MODIFY] [constants.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/kernel/src/constants.ts)
- Update `HDR` to include `SYNAPSE_CAPACITY` (if not present) and `SYNAPSE_COUNT`.
- Update `calculateSABSize` to accept `synapseCapacity`.
- Remove or deprecate fixed `SYNAPSE_TABLE.CAPACITY` if it exists.

#### [MODIFY] [types.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/kernel/src/types.ts)
- Add `synapseCapacity` (optional) to `LinkerConfig` interface.

#### [MODIFY] [init.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/kernel/src/init.ts)
- Update `createLinkerSAB` to:
    - Determine `synapseCapacity`: use config value or default to `nodeCapacity * 8`.
    - Pass `synapseCapacity` to `calculateSABSize`.
    - Write `synapseCapacity` to `HDR.SYNAPSE_CAPACITY`.
    - Pass `synapseCapacity` to `initializeSynapseTable`.
- Update `initializeSynapseTable` to accept capacity argument.
- Update `resetLinkerSAB` to read capacity from Header and re-initialize correctly.

#### [MODIFY] [silicon-synapse.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/kernel/src/silicon-synapse.ts)
- Constructor: Read `synapseCapacity` from `HDR.SYNAPSE_CAPACITY`.
- Update `SynapseAllocator` usage if needed (pass capacity).

#### [MODIFY] [synapse-allocator.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/kernel/src/synapse-allocator.ts) / [synapse-view.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/kernel/src/synapse-view.ts)
- Ensure they use the dynamic capacity from the SAB Header rather than a constant.

## Verification Plan

### Automated Tests
- Create `src/__tests__/k-002-scalability.test.ts`:
    - **Test 1: Default Scaling**: Create SAB with 1024 nodes, assert Synapse Capacity is 8192.
    - **Test 2: Explicit Config**: Create SAB with 1024 nodes and explicit 20000 synapses, assert capacity is 20000.
    - **Test 3: Boundary**: Fill table up to capacity (or near collision limit) to ensure dynamic sizing works logic-wise.
