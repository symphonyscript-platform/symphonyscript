# synaptic-kernel — Agent instructions

## Read order

1. `ARCHITECTURE.md` — what the kernel is and how its parts relate. Read before any non-trivial change.
2. `CONVENTIONS.md` — how to write code that fits this kernel. Read before writing code.
3. Source — only after both above. Source comments document local invariants; they do not document architecture.

## Hard rules — violating these breaks the kernel

- **Consumer must traverse from head every swap.** Cached slot pointers are valid within one cycle (between two `swap()`
  calls); they are invalid across cycles. After `swap()`, the producer is permitted to reclaim deferred slots and
  reallocate them — a cached pointer may now reference a different entity. Re-traverse from `get_head_node()` every
  cycle.

- **Consumer must be quiesced before `Kernel` drop or `serialize()`.** Drop unconditionally frees the deferred-deletion
  queue. Serialize captures memory mid-flight. Either while the consumer is active is undefined behavior.

- **No allocation on the producer hot path.** Allocation is permitted only inside `Kernel::new`, `load_serialized`,
  `grow`, and the internal `Box`/`Box::from_raw` for mirror swap. Anywhere else, you've broken wait-freedom.

- **Every primitive that backs a memory region must support `bind`.** `new` zero-initializes; `bind` assumes valid
  existing state. Serialization replay needs both. Adding a primitive without `bind` breaks `load_serialized`.

- **User TB / store / LUT IDs must form a permutation of `[0, N-1]`.** No gaps, no duplicates.
  `TripleBufferId::DEFAULT` (`u16::MAX`) is reserved and must not appear in user `tb_defs`.

- **Atomic ordering: `Relaxed` is the default.** `Acquire`/`Release`/`AcqRel` appear only at the publish/swap fences,
  the staging-buffer generation handshake, and the `ControlPlane` epoch handshake. If you reach for `SeqCst` on a
  payload read, you've misunderstood the protocol — surface the question first.

- **Slot 0 is "undefined."** Slot APIs are 1-based throughout. Storing or comparing against 0 is the convention for "no
  slot."

- **Producer thread / consumer thread separation is a contract, not enforced by types.** Every `*Writer` / `Epoch` /
  `Kernel` method is producer-only. Every `*Reader` / `EpochMirror` / `EpochConsumer` method is consumer-only. The
  `Arc<ControlPlane>` is the only legal cross-thread bridge.

- **`grow()` is monotonic.** Every dimension in the new config must be `>= current`. There is no shrink path.

## Where to look

- Architecture overview, planes, generation stack: `ARCHITECTURE.md`
- Construction patterns, naming, sizing, atomic rules, terminology: `CONVENTIONS.md`
- Test harness shared config: `tests/common/mod.rs`
- Real-thread SPSC test patterns: `tests/kernel_concurrent_test.rs`, `tests/triple_buffer_test.rs`
- Property-test oracle pattern: `tests/staging_buffer_prop_test.rs`
- Hot-swap stress patterns: `tests/epoch_stress_test.rs`

## When in doubt

If a change touches memory layout, threading, the generation protocol, or slot-allocator behavior — stop. Surface the
design question before writing code. The kernel's invariants are tightly coupled; a "small fix" in one place often
invalidates a guarantee in another.
