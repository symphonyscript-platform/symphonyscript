# RFC-057: Rust Kernel Port

**Status**: DRAFT (Future Architecture)  
**Priority**: LOW (Reference Document)  
**Author**: Architect  
**Created**: 2026-02-01  
**Depends On**: RFC-055 (SPSC FreeList), RFC-056 (Per-Worker Heaps)

## 1. Abstract

This RFC documents the architecture for porting the SymphonyScript kernel from TypeScript to Rust. The current JS implementation has reached the performance ceiling of the language. A Rust port would provide:

- Zero GC pauses (no garbage collector)
- SIMD acceleration (AVX2/NEON)
- Cache-aligned memory layouts
- Predictable timing (no JIT)
- Thread priority control (native APIs)

**This RFC is a reference document, not an immediate implementation proposal.** It exists to:
1. Document the porting strategy before knowledge is lost
2. Ensure the current JS kernel remains "port-ready"
3. Provide a clear technical roadmap for native performance

## 2. Motivation

### 2.1 JavaScript Ceiling

The current kernel uses every optimization available in JavaScript:

| Technique | Status |
|-----------|--------|
| SharedArrayBuffer | ✅ Used |
| Atomics primitives | ✅ Used |
| Zero allocation (after RFC-055) | ✅ Achieved |
| Lock-free structures | ✅ SPSC per zone |
| AudioWorklet | ✅ Designed for |

**There is nothing left to optimize in JavaScript.**

### 2.2 What Rust Provides

| Capability | JavaScript | Rust |
|------------|------------|------|
| GC pauses | Mitigated, not eliminated | None |
| SIMD | ❌ Not available | ✅ AVX2, NEON |
| Cache alignment | ❌ Not available | ✅ `#[repr(align(64))]` |
| Thread priority | ❌ Not available | ✅ `pthread_setschedparam` |
| Predictable timing | ⚠️ JIT variance | ✅ Deterministic |
| Audio buffer size | 128 samples (Web Audio) | 32 samples (ASIO) |

### 2.3 Deployment Targets

A Rust kernel enables:

| Target | Binding | Use Case |
|--------|---------|----------|
| Browser | WASM (wasm-bindgen) | Web DAW |
| Electron | napi-rs | Desktop DAW |
| Standalone | Native binary | CLI tools, servers |
| Mobile | iOS/Android FFI | Mobile apps |

## 3. Architecture

### 3.1 Current TypeScript Structure

```
packages/kernel/src/
├── constants.ts          → rust-kernel/src/constants.rs
├── types.ts              → rust-kernel/src/types.rs
├── init.ts               → rust-kernel/src/init.rs
├── free-list.ts          → rust-kernel/src/free_list.rs
├── local-allocator.ts    → rust-kernel/src/local_allocator.rs
├── ring-buffer.ts        → rust-kernel/src/ring_buffer.rs
├── silicon-synapse.ts    → rust-kernel/src/synapse.rs
├── silicon-bridge.ts     → (Remains in JS - UI layer)
├── patch.ts              → rust-kernel/src/patch.rs
├── synapse-allocator.ts  → rust-kernel/src/synapse_alloc.rs
└── synapse-view.ts       → rust-kernel/src/synapse_view.rs
```

### 3.2 Rust Crate Structure

```
rust-kernel/
├── Cargo.toml
├── src/
│   ├── lib.rs              # Public API
│   ├── constants.rs        # Memory layout, opcodes, flags
│   ├── types.rs            # NodePtr, SynapsePtr, etc.
│   ├── sab.rs              # SharedBuffer wrapper
│   ├── free_list.rs        # SPSC allocator
│   ├── local_allocator.rs  # Zone B bump allocator
│   ├── ring_buffer.rs      # SPSC command queue
│   ├── synapse.rs          # Core kernel (SiliconSynapse)
│   ├── patch.rs            # Attribute patching
│   ├── synapse_alloc.rs    # Neural connection manager
│   └── synapse_view.rs     # Read-only synapse access
├── benches/
│   └── kernel_bench.rs     # Criterion benchmarks
└── tests/
    └── integration.rs      # Port of JS test suite
```

### 3.3 FFI Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                    JavaScript Layer                          │
│  SiliconBridge, UI, Editor, Composer                        │
│                         │                                    │
│                         ▼                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              FFI Boundary (wasm-bindgen)             │   │
│  │  • create_kernel(buffer: &[u8]) -> Kernel           │   │
│  │  • kernel.alloc_node() -> u32                       │   │
│  │  • kernel.process_commands()                        │   │
│  │  • kernel.insert_head(...) -> u32                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                         │                                    │
│                         ▼                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 Rust Kernel                          │   │
│  │  • Zero GC                                          │   │
│  │  • SIMD batch ops                                   │   │
│  │  • Cache-aligned structures                         │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 4. Translation Guide

### 4.1 SharedArrayBuffer → SharedBuffer

**TypeScript:**
```typescript
class SiliconSynapse {
  private sab: Int32Array
  
  constructor(buffer: SharedArrayBuffer) {
    this.sab = new Int32Array(buffer)
  }
}
```

**Rust:**
```rust
use std::sync::atomic::{AtomicI32, Ordering};

pub struct SharedBuffer {
    ptr: *mut AtomicI32,
    len: usize,
}

impl SharedBuffer {
    /// # Safety
    /// Caller must ensure `ptr` is valid for `len` i32 elements
    pub unsafe fn from_raw(ptr: *mut u8, byte_len: usize) -> Self {
        debug_assert!(byte_len % 4 == 0);
        Self {
            ptr: ptr as *mut AtomicI32,
            len: byte_len / 4,
        }
    }
    
    pub fn load(&self, index: usize) -> i32 {
        debug_assert!(index < self.len);
        unsafe { (*self.ptr.add(index)).load(Ordering::Acquire) }
    }
    
    pub fn store(&self, index: usize, value: i32) {
        debug_assert!(index < self.len);
        unsafe { (*self.ptr.add(index)).store(value, Ordering::Release) }
    }
}
```

### 4.2 Atomics

| TypeScript | Rust |
|------------|------|
| `Atomics.load(sab, i)` | `sab.load(i)` or `sab[i].load(Ordering::Acquire)` |
| `Atomics.store(sab, i, v)` | `sab.store(i, v)` or `sab[i].store(v, Ordering::Release)` |
| `Atomics.add(sab, i, v)` | `sab[i].fetch_add(v, Ordering::SeqCst)` |
| `Atomics.sub(sab, i, v)` | `sab[i].fetch_sub(v, Ordering::SeqCst)` |
| `Atomics.compareExchange(sab, i, e, v)` | `sab[i].compare_exchange(e, v, Ordering::SeqCst, Ordering::Relaxed)` |

### 4.3 Constants

**TypeScript:**
```typescript
export const HDR = {
  MAGIC: 0,
  VERSION: 1,
  NODE_CAPACITY: 2,
} as const
```

**Rust:**
```rust
pub mod hdr {
    pub const MAGIC: usize = 0;
    pub const VERSION: usize = 1;
    pub const NODE_CAPACITY: usize = 2;
}
```

### 4.4 Error Handling

**TypeScript:**
```typescript
alloc(): NodePtr {
  if (head === NULL_PTR) {
    return NULL_PTR  // Error via sentinel
  }
  return head
}
```

**Rust:**
```rust
pub fn alloc(&mut self) -> Option<NodePtr> {
    let head = self.sab.load(hdr::FREE_LIST_HEAD);
    if head == NULL_PTR {
        return None;
    }
    Some(NodePtr(head as u32))
}
```

### 4.5 Traversal Callbacks

**TypeScript:**
```typescript
traverse(callback: (data: NodeData) => void): void {
  let ptr = this.getHeadPtr()
  while (ptr !== NULL_PTR) {
    const data = this.readNode(ptr)
    callback(data)
    ptr = data.nextPtr
  }
}
```

**Rust (Iterator):**
```rust
pub fn iter(&self) -> NodeIterator<'_> {
    NodeIterator {
        synapse: self,
        current: self.get_head_ptr(),
    }
}

pub struct NodeIterator<'a> {
    synapse: &'a SiliconSynapse,
    current: Option<NodePtr>,
}

impl<'a> Iterator for NodeIterator<'a> {
    type Item = NodeData;
    
    fn next(&mut self) -> Option<Self::Item> {
        let ptr = self.current?;
        let data = self.synapse.read_node(ptr);
        self.current = data.next_ptr;
        Some(data)
    }
}
```

## 5. SIMD Acceleration

### 5.1 Batch Traversal

**Current JS (Sequential):**
```typescript
while (ptr !== NULL_PTR) {
  const baseTick = this.sab[offset + NODE.BASE_TICK]
  if (baseTick >= playhead && baseTick < playhead + quantum) {
    // Emit note
  }
  ptr = nextPtr
}
```

**Rust (SIMD):**
```rust
use std::simd::*;

pub fn find_notes_in_range(&self, playhead: i32, quantum: i32) -> Vec<NodePtr> {
    let mut results = Vec::new();
    let end = playhead + quantum;
    
    // Process 8 nodes at a time
    for chunk in self.nodes.chunks_exact(8) {
        let ticks: i32x8 = i32x8::from_array([
            chunk[0].base_tick, chunk[1].base_tick,
            chunk[2].base_tick, chunk[3].base_tick,
            chunk[4].base_tick, chunk[5].base_tick,
            chunk[6].base_tick, chunk[7].base_tick,
        ]);
        
        let ge_playhead = ticks.simd_ge(i32x8::splat(playhead));
        let lt_end = ticks.simd_lt(i32x8::splat(end));
        let in_range = ge_playhead & lt_end;
        
        let mask = in_range.to_bitmask();
        for i in 0..8 {
            if mask & (1 << i) != 0 {
                results.push(chunk[i].ptr);
            }
        }
    }
    
    results
}
```

**Speedup:** 4-8x for batch note lookup.

### 5.2 Synapse Table Scan

Compaction phase 1 (finding live entries) can use SIMD to check 8 entries at once.

## 6. Memory Layout

### 6.1 Cache-Aligned Node

**Current (32 bytes, unaligned):**
```typescript
const NODE_SIZE_BYTES = 32
```

**Rust (64 bytes, cache-line aligned):**
```rust
#[repr(C, align(64))]
pub struct Node {
    pub packed_a: AtomicI32,      // 4
    pub base_tick: AtomicI32,     // 4
    pub duration: AtomicI32,      // 4
    pub next_ptr: AtomicI32,      // 4
    pub prev_ptr: AtomicI32,      // 4
    pub source_id: AtomicI32,     // 4
    pub seq_flags: AtomicI32,     // 4
    pub last_pass_id: AtomicI32,  // 4
    _padding: [u8; 32],           // 32 (pad to 64 bytes)
}
```

**Benefit:** Eliminates false sharing between adjacent nodes.

## 7. WASM Bindings (wasm-bindgen)

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Kernel {
    inner: SiliconSynapse,
}

#[wasm_bindgen]
impl Kernel {
    #[wasm_bindgen(constructor)]
    pub fn new(buffer: &[u8]) -> Result<Kernel, JsValue> {
        let synapse = unsafe { 
            SiliconSynapse::from_buffer(buffer.as_ptr() as *mut u8, buffer.len())
        };
        Ok(Kernel { inner: synapse })
    }
    
    pub fn alloc_node(&mut self) -> i32 {
        self.inner.alloc_node().map(|p| p.0 as i32).unwrap_or(-1)
    }
    
    pub fn process_commands(&mut self) {
        self.inner.process_commands();
    }
    
    pub fn insert_head(
        &mut self,
        opcode: i32,
        pitch: i32,
        velocity: i32,
        duration: i32,
        base_tick: i32,
        source_id: i32,
        flags: i32,
    ) -> i32 {
        self.inner.insert_head(opcode, pitch, velocity, duration, base_tick, source_id, flags)
            .map(|p| p.0 as i32)
            .unwrap_or(-1)
    }
}
```

## 8. Native Bindings (napi-rs for Electron)

```rust
use napi::*;
use napi_derive::napi;

#[napi]
pub struct Kernel {
    inner: SiliconSynapse,
}

#[napi]
impl Kernel {
    #[napi(constructor)]
    pub fn new(buffer: Buffer) -> Result<Self> {
        let synapse = unsafe {
            SiliconSynapse::from_buffer(buffer.as_ptr() as *mut u8, buffer.len())
        };
        Ok(Kernel { inner: synapse })
    }
    
    #[napi]
    pub fn alloc_node(&mut self) -> i32 {
        self.inner.alloc_node().map(|p| p.0 as i32).unwrap_or(-1)
    }
    
    #[napi]
    pub fn process_commands(&mut self) {
        self.inner.process_commands();
    }
}
```

## 9. Migration Strategy

### Phase 1: Parallel Implementation
- Create `rust-kernel/` crate alongside `packages/kernel/`
- Port module by module, testing against JS implementation
- Maintain byte-compatible SAB format

### Phase 2: Benchmarking
- Use Criterion for Rust benchmarks
- Compare against JS benchmarks
- Validate SIMD acceleration gains

### Phase 3: WASM Integration
- Add wasm-bindgen bindings
- Create `packages/kernel-wasm/` package
- Provide fallback to JS kernel if WASM unavailable

### Phase 4: Native Integration (Optional)
- Add napi-rs bindings for Electron
- Test in desktop DAW context
- Validate thread priority and ASIO buffer sizes

## 10. Compatibility

### 10.1 SAB Binary Compatibility

The Rust kernel MUST use the same SAB memory layout as the JS kernel:

- Same header offsets
- Same node structure
- Same synapse table format

This allows:
- JS and Rust kernels to operate on the same SAB
- Gradual migration (some operations in JS, some in Rust)
- Fallback to JS if WASM fails

### 10.2 API Compatibility

The Rust kernel exports the same public API:
- `alloc_node() -> NodePtr`
- `free_node(ptr)`
- `insert_head(...) -> NodePtr`
- `delete_node(ptr)`
- `process_commands()`
- `traverse(callback)`

Callers should not know whether they're using JS or Rust.

## 11. Performance Targets

| Operation | JS Baseline | Rust Target | Speedup |
|-----------|-------------|-------------|---------|
| `alloc_node` | 5µs | 1µs | 5x |
| `patch_pitch` | 5µs | 0.5µs | 10x |
| `insert_head` | 30µs | 5µs | 6x |
| Batch traverse (1000 nodes) | 500µs | 50µs (SIMD) | 10x |
| Synapse compaction (8K entries) | 8ms | 1ms (SIMD) | 8x |

## 12. When to Implement

**Implement when:**
- JS kernel latency is insufficient for use case
- Desktop DAW deployment is prioritized
- SIMD batch processing is needed

**Do not implement if:**
- Browser-only deployment is sufficient
- Development velocity is prioritized over raw performance
- Team lacks Rust expertise

## 13. References

- RFC-055: SPSC FreeList
- RFC-056: Per-Worker Heap Scaling
- [wasm-bindgen Book](https://rustwasm.github.io/wasm-bindgen/)
- [napi-rs Documentation](https://napi.rs/)
- [std::simd RFC](https://github.com/rust-lang/rfcs/blob/master/text/2948-portable-simd.md)
