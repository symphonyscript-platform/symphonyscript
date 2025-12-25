export { SiliconSynapse } from './silicon-synapse';
export { getModulatedTime } from './scheduler';
export { SL_MAGIC, SL_VERSION, DEFAULT_PPQ, DEFAULT_BPM, DEFAULT_SAFE_ZONE_TICKS, NULL_PTR, KNUTH_HASH_CONST, HDR, REG, NODE, NODE_SIZE_I32, NODE_SIZE_BYTES, PACKED, SEQ, FLAG, OPCODE, COMMIT, ERROR, calculateSABSize, HEAP_START_OFFSET, HEAP_START_I32, COMMAND, CMD, DEFAULT_RING_CAPACITY, getZoneSplitIndex, getRingBufferOffset, SYNAPSE_TABLE, SYNAPSE, REVERSE_INDEX, getReverseIndexOffset, SYN_PACK, SYNAPSE_QUOTA, getSynapseTableOffset, SOURCE_ID, } from './constants';
export type { Opcode, CommitState, ErrorCode, NodeFlag } from './constants';
export type { NodePtr, SynapsePtr, PlasticityCallback, SynapseResolutionCallback, LinkerConfig, EditResult, ISiliconLinker } from './types';
export { createLinkerSAB, validateLinkerSAB, getLinkerConfig, resetLinkerSAB, writeGrooveTemplate, readGrooveTemplate } from './init';
export { FreeList } from './free-list';
export { AttributePatcher } from './patch';
export { LocalAllocator } from './local-allocator';
export { RingBuffer } from './ring-buffer';
export { SynapseAllocator } from './synapse-allocator';
export { MockConsumer } from './mock-consumer';
export type { ConsumerNoteEvent } from './mock-consumer';
export { SiliconBridge, createSiliconBridge } from './silicon-bridge';
export type { SourceLocation, EditorNoteData, PatchType, SiliconBridgeOptions, SynapseOptions, BrainSnapshotArrays, } from './silicon-bridge';
//# sourceMappingURL=index.d.ts.map