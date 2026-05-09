Refreshed. Here's the breakdown.

## Dismissed (no action needed)

| #  | Concern                                | Why dismissed                                                                                              |
|----|----------------------------------------|------------------------------------------------------------------------------------------------------------|
| 2  | "Traverse from head" not type-enforced | Resolved by removing the head concept entirely. Consumer entry is now user-side discipline by design.      |
| 3  | Staging buffer overflow                | Walked through math; structurally unreachable under correct usage. Defensive error path is fine as-is.     |
| 5  | `grow()` blocks producer thread        | `grow()` is escape hatch, not hot path. Incremental migration would destroy the "one mirror" model.        |
| 12 | "Tests are thin"                       | Retracted after reading. 820 tests, real SPSC stress, proptest oracles. Coverage is solid where it exists. |

## Stands — concrete actions

Grouped by where the work happens.

### Kernel source — small, surgical

**S1. Promote domain-op asserts from `debug_assert!` to `assert!`.**

- *What:* Inside `EntryStoreWriter::insert`, `EntryStoreWriter::remove`, `NetworkWriter::connect`,
  `NetworkWriter::disconnect`, `NetworkWriter::disconnect_synapse`, `NetworkWriter::remove_node`,
  `NetworkWriter::remove_chain`, `NodeStoreWriter::insert_node`, `NodeStoreWriter::insert_node_after`,
  `NodeStoreWriter::insert_node_before`, `NodeStoreWriter::remove_node` — convert slot-validity and link-consistency
  `debug_assert!`s to `assert!`. Leave `EntryWriter::core_read/write/...`, `MemZoneWriter::*`, `TbZoneWriter::*` and
  other per-frame accessors as `debug_assert!`.
- *Where:* `src/primitives/entry_store_writer.rs`, `src/topology/network/network_writer.rs`,
  `src/topology/node/node_store_writer.rs`.
- *Why:* These ops are called per-graph-mutation, not per-frame. Cost is invisible. Catches caller bugs that today
  silently corrupt slot state in release builds.

**S2. Delete `wide_atomic.rs`.**

- *What:* Remove `src/wide_atomic.rs` and the `pub mod wide_atomic;` line in `src/lib.rs`.
- *Where:* `src/wide_atomic.rs`, `src/lib.rs:15`.
- *Why:* Confirmed via grep — zero usages outside its own tests. You stated the kernel is not i64. An unused public API
  surface is a future foot-gun: someone will use it without realizing the torn-read semantics.

**S3. Switch `AtomicBuffer` from `Arc<Vec<AtomicI32>>` to `Arc<[AtomicI32]>`.**

- *What:* Change the type alias in `src/primitives/types.rs`. Update construction sites in `kernel.rs` (`create_mem`)
  and `serialization` paths to build `Arc<[AtomicI32]>` (e.g.
  `(0..size).map(|_| AtomicI32::new(0)).collect::<Box<[_]>>().into()`).
- *Where:* `src/primitives/types.rs`, `src/kernel.rs::create_mem`, anywhere else that constructs the buffer.
- *Why:* The TODO comment in `types.rs` already notes this. `Vec` adds a heap indirection (Vec metadata → separate
  allocation for the data) that gives nothing — the buffer is fixed-size after construction; you don't need `cap`. One
  fewer pointer chase per access.

**S4. Add `Kernel::drop` debug-time quiescence assert.**

- *What:* Implement `impl Drop for Kernel` with `#[cfg(debug_assertions)]` body asserting
  `control_plane.writer_generation == control_plane.reader_ack_generation`. Release builds drop normally.
- *Where:* `src/kernel.rs` — new `Drop` impl. Currently there is no `Drop` for `Kernel`, only auto-derived.
- *Why:* The "consumer must be quiesced before Kernel drop" rule is documented but enforced nowhere. Forgetting it is
  silent UB. Debug assert makes the violation loud in development with zero release-build cost. Catches the most common
  form: programmer drops `Kernel` while consumer thread still holds an `EpochConsumer`.

**S5. Validate ID permutations in `Kernel::grow()`.**

- *What:* In `Kernel::grow`, after capacity checks, iterate the new config's `tb_defs`, `store_defs`, `lut_defs` and
  verify each *set of IDs* is the same as the old config's. The current code only verifies "find an entry with the
  matching ID" — silently accepts re-numbering.
- *Where:* `src/kernel.rs::grow`.
- *Why:* If the user passes a new config with the same TB count but renames an ID, the layout silently shifts and
  previously-valid handles become invalid. `grow()` is supposed to be a forgiving safety net; silently changing topology
  IDs is the opposite. Add an explicit `KernelError::IdMismatch` variant or reuse `InsufficientCapacity`.

### Kernel source — bigger, more intrusive (defer or schedule)

**S6. Type-separate `TripleBufferId::DEFAULT` from the `id_index` "unassigned" sentinel.**

- *What:* Inside `TripleBufferWriterRegistry` (and the entry store / LUT registry equivalents), change
  `id_index: [u16; N]` to `id_index: [Option<u16>; N]`. Replace `u16::MAX` sentinel writes/checks with `None` /
  `Some(...)`. Public `TripleBufferId(u16)` stays as-is. The two ID spaces are now nominally distinct.
- *Where:* `src/primitives/triple_buffer_writer_registry.rs`, `src/primitives/triple_buffer_reader_registry.rs`,
  `src/primitives/entry_store_writer_registry.rs`, `src/primitives/entry_store_reader_registry.rs`,
  `src/primitives/lut_writer_registry.rs`, `src/primitives/lut_reader_registry.rs`.
- *Why:* Today `u16::MAX` means both "the kernel-internal default TB" (public ID) and "this slot in id_index has no
  mapping" (internal sentinel). They never collide functionally because `DEFAULT` is short-circuited before indexing —
  but a future refactor that forgets the short-circuit would index `id_index[u16::MAX as usize]` which is an
  out-of-bounds read in release. `Option<u16>` carries the same memory cost (niche optimization) and is statically safe.

**S7. Introduce `SlotId(NonZeroU32)` for slot pointers.**

- *What:* Define `pub struct SlotId(NonZeroU32);` in a new `src/primitives/slot_id.rs` (or in `src/primitives/slot.rs`
  next to existing `SlotId(u16)` — note: there's already a `SlotId(u16)` in `slot.rs` that may need merging or renaming
  first). Public APIs (`insert_node`, `connect`, `remove_node`, `get_node`, etc.) take and return `SlotId` /
  `Option<SlotId>` instead of `usize`. The `as i32` / `as usize` casts move to one boundary: where `SlotId` is loaded
  from / stored to TB. Add a const-time check that store capacity ≤ `i32::MAX`.
- *Where:* Wide. Touches the entire public API surface of `Kernel`, `NetworkWriter`, `NodeStoreWriter`,
  `EntryStoreWriter`, all readers, and the test files that use them.
- *Why:* Today every accessor on `NodeWriter`/`SynapseWriter` does `as usize` on read and `as i32` on write — every site
  is a chance to silently truncate. `NonZeroU32` bakes "0 = undefined" into the type system, eliminates Option overhead
  via niche optimization, and confines casts to one location. **Cost: large API churn.** Worth doing now (before
  external consumers exist) or never. *Recommendation: do it now while you control all the callers.*

### Documentation

**D1. Document the asymmetry of `grow()`.**

- *What:* Add a sentence to ARCHITECTURE.md "Hot-swap and grow" section explicitly stating that `grow()` is
  monotonic-only, intentionally so, and there is no `shrink()` planned for the near term.
- *Where:* `packages/synaptic-kernel/ARCHITECTURE.md`, "Hot-swap and grow" section.
- *Why:* Long-term users will assume symmetric resize from the name. Already partially in CLAUDE.md as a hard rule (
  `grow() is monotonic`), but ARCHITECTURE.md should also say it where users go to learn the model.

**D2. Document staging buffer telemetry.**

- *What:* Add a one-paragraph note in ARCHITECTURE.md explaining that `deferred_count()` exists and what it means under
  stress (consumer falling behind = deferred_count climbs). Suggest using it as a health metric.
- *Where:* `packages/synaptic-kernel/ARCHITECTURE.md`, in or near the "Slot allocation and deferred deletion" section.
- *Why:* The `Full` error path is structurally unreachable but the slow-consumer condition is real and observable via
  `deferred_count`. Without docs, users don't know the metric exists or what it means.

### Tests — gaps to fill

**T1. Add loom tests for the SPSC handshakes.**

- *What:* Add a `cfg(loom)` test target. Re-implement the three handshake protocols against `loom::sync::atomic`:
  triple-buffer publish/swap, staging-buffer generation gate, ControlPlane epoch swap. Each as a small loom test that
  exhausts plausible interleavings.
- *Where:* `tests/loom_*.rs` files (gated by feature flag), `Cargo.toml` adds `loom` as dev dependency under a feature.
- *Why:* All current concurrency tests run on x86 TSO. Memory-ordering bugs that depend on weaker-memory-model
  interleavings (ARM, RISC-V) will pass on x86 forever and ship broken. Loom exhaustively explores. Single biggest gap
  in the test suite.

**T2. Add multi-config (non-`<1,1,1>`) registry tests.**

- *What:* Add a test file (or extend `entry_store_writer_registry_test.rs`) with a config like `Kernel<2, 4, 2>` where
  stores 0 and 1 share TB 0, stores 2 and 3 share TB 1 (or similar). Verify cursor offsets correctly stack stores within
  a single TB.
- *Where:* `tests/multi_config_test.rs` or extension of `tests/entry_store_writer_registry_test.rs`.
- *Why:* Almost all current tests use `<1,1,1>`. The `extra_tb_cursors[index]` cursor logic in
  `EntryStoreWriterRegistry::create` has never been exercised against multiple stores sharing a TB. If the cursor math
  is off, no current test catches it.

**T3. Investigate and fix the `Arc::from_raw` dance in `epoch_stress_test.rs`.**

- *What:* Lines ~47-50 (and repeated) do `Arc::as_ptr` + `Arc::from_raw` + `mem::forget` to share `Arc<ControlPlane>`
  across `thread::spawn`. Compare with `kernel_concurrent_test.rs` which uses the safe
  `Arc::clone(&cp); thread::spawn(move || { /* clone */ })` pattern. Either replace the unsafe code with the safe
  pattern, or document why the unsafe pattern is necessary.
- *Where:* `tests/epoch_stress_test.rs`.
- *Why:* `Arc<ControlPlane>` is `Send` — the safe pattern works. The unsafe dance is either a workaround for a borrow
  issue that no longer exists, or it's leaking refcounts (the `mem::forget` after constructing `processor` from a
  `clone` is suspicious). Two patterns for the same problem in the same suite is a code smell.

**T4. Add bind-mid-publish round-trip test.**

- *What:* Build a kernel, do partial mutations, call `serialize()` deliberately mid-publish (writer_index updated,
  NEW_DATA set, but consumer hasn't swapped). Then `load_serialized` and verify the rebound writer recovers correctly
  via `TripleBufferWriter::bind`'s Acquire-load-then-sync logic.
- *Where:* New tests in `tests/serialization_test.rs`.
- *Why:* The `bind` path in `TripleBufferWriter::create` has explicit code for this case (
  `load Acquire on state, then sync`). Currently nothing exercises it directly. If that path is broken, only a real
  bind-after-mid-publish would catch it.

**T5. Add capacity-saturation cycling test.**

- *What:* Test that does: alloc to full capacity → defer-free all → publish → consumer ack → publish again → verify all
  reclaimed → alloc to capacity again succeeds.
- *Where:* New test in `tests/slot_allocator_test.rs` or `tests/kernel_test.rs`.
- *Why:* Off-by-one errors in the deferred-reclamation path hide here. The current tests cover individual operations but
  not the full saturation cycle.

**T6. Add `kind` boundary tests.**

- *What:* Three tests: `set_kind(255)` round-trips correctly without corrupting the lower 24 bits; `set_kind(0)` works;
  `set_kind(256)` panics in debug builds (use `should_panic`).
- *Where:* `tests/kernel_writer_test.rs` or similar.
- *Why:* Catches a future "let's expand kind to 16 bits" refactor that forgets to update the bitmask. Quick, cheap.

**T7. Add `grow()` validation negative tests.**

- *What:* One test per shrinking dimension: `grow` with smaller `node_capacity`, smaller `synapse_capacity`, smaller
  `mem_metadata_size`, smaller per-TB capacity, smaller per-store capacity, smaller per-LUT size. Each must return
  `KernelError::InsufficientCapacity`.
- *Where:* `tests/kernel_test.rs` or new `tests/grow_validation_test.rs`.
- *Why:* The four validation branches in `Kernel::grow` are untested. One off-by-one comparison and `grow()` silently
  accepts a shrink, corrupts the buffer.

---

## Recommended order

If you want to slot this into a priority sequence:

1. **S2** (delete `wide_atomic.rs`) — 5 minutes, removes a foot-gun. Do today.
2. **S4** (Drop assert) — 15 minutes, prevents UB class. Do today.
3. **D1, D2** (docs) — 15 minutes total.
4. **S1** (promote asserts) — half a day, but each site is independent.
5. **T6, T7** (kind boundary, grow validation) — half a day, fills negative-path gaps cheaply.
6. **T3** (investigate `Arc::from_raw`) — could be 30 minutes, could be a real fix. Worth scheduling soon.
7. **S5** (grow ID validation) — half a day.
8. **S3** (`Arc<[AtomicI32]>`) — half a day, mostly mechanical.
9. **S6** (Option-typed id_index) — a day, touches multiple registry files.
10. **T2** (multi-config tests) — a day, requires writing the configs.
11. **T5, T4** (saturation, bind-mid-publish) — a day each.
12. **S7** (SlotId newtype) — 1-2 weeks of API churn. Schedule as a focused effort, not interleaved.
13. **T1** (loom) — multi-day. Highest value for shipping to non-x86 platforms; lowest urgency until you actually do.

S2, S4, D1, D2 are essentially free. S7 and T1 are the two big investments worth doing on purpose. Everything else is
half-day work.
