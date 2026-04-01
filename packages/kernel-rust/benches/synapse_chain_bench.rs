use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use std::sync::Arc;
use std::sync::atomic::AtomicI32;
use symphonyscript_kernel::constants::{NODE_SLOT_SIZE, SYNAPSE_SLOT_SIZE};
use symphonyscript_kernel::primitives::types::SAB;
use symphonyscript_kernel::primitives::triple_buffer::TripleBuffer;
use symphonyscript_kernel::primitives::simple_free_list::SimpleFreeList;
use symphonyscript_kernel::structural_plane::structural_writer::StructuralWriter;
use symphonyscript_kernel::structural_plane::structural_reader::StructuralReader;
use symphonyscript_kernel::structural_plane::node::node_chain_writer::NodeChainWriter;
use symphonyscript_kernel::structural_plane::node::node_chain_reader::NodeChainReader;
use symphonyscript_kernel::structural_plane::node::node_data::NodeDraft;
use symphonyscript_kernel::structural_plane::synapse::synapse_chain_writer::SynapseChainWriter;
use symphonyscript_kernel::structural_plane::synapse::synapse_chain_reader::SynapseChainReader;
use symphonyscript_kernel::structural_plane::synapse::synapse_data::SynapseDraft;

fn create_sab(size: usize) -> SAB {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

const SAB_SIZE: usize = 262144;
const TB_START: usize = 0;
const TB_BUF_CAP: usize = 65536;
const NODE_CAPACITY: usize = 512;
const SYNAPSE_CAPACITY: usize = 2048;
const NODE_START_OFFSET: usize = 0;
const NODE_HEAD_OFFSET: usize = NODE_CAPACITY * NODE_SLOT_SIZE;
const SYNAPSE_START_OFFSET: usize = NODE_HEAD_OFFSET + 1;
const NODE_FL_START: usize = 200000;
const SYNAPSE_FL_START: usize = 210000;

struct Harness {
    _sab: SAB,
    writer: symphonyscript_kernel::primitives::triple_buffer::TripleBufferWriter,
    reader: symphonyscript_kernel::primitives::triple_buffer::TripleBufferReader,
    node_fl: SimpleFreeList,
    synapse_fl: SimpleFreeList,
}

fn setup() -> Harness {
    let sab = create_sab(SAB_SIZE);
    let (writer, reader) = TripleBuffer::new(Arc::clone(&sab), TB_START, TB_BUF_CAP);
    let node_fl = SimpleFreeList::new(Arc::clone(&sab), NODE_FL_START, NODE_CAPACITY);
    let synapse_fl = SimpleFreeList::new(Arc::clone(&sab), SYNAPSE_FL_START, SYNAPSE_CAPACITY);
    Harness {
        _sab: sab,
        writer,
        reader,
        node_fl,
        synapse_fl,
    }
}

// ============ connect: single synapse (cold) ============

fn bench_connect_single(c: &mut Criterion) {
    let h = setup();
    let node_sw = StructuralWriter::<NODE_SLOT_SIZE>::new(&h.writer, &h.node_fl, NODE_START_OFFSET, NODE_CAPACITY);
    let synapse_sw = StructuralWriter::<SYNAPSE_SLOT_SIZE>::new(&h.writer, &h.synapse_fl, SYNAPSE_START_OFFSET, SYNAPSE_CAPACITY);
    let node_chain = NodeChainWriter::new(&h.writer, &node_sw, NODE_HEAD_OFFSET);
    let synapse_chain = SynapseChainWriter::new(&node_chain, &synapse_sw);

    let src = node_chain.insert_head(NodeDraft { opcode: 1, base_tick: 0 }).unwrap();
    let tgt = node_chain.insert_head(NodeDraft { opcode: 2, base_tick: 0 }).unwrap();

    c.bench_function("SynapseChain/connect_single", |b| {
        b.iter(|| {
            let syn = synapse_chain.connect(
                black_box(src), black_box(tgt), SynapseDraft { opcode: black_box(10) }
            ).unwrap();
            synapse_chain.disconnect(syn).unwrap();
        });
    });
}

// ============ disconnect: single synapse (cold) ============

fn bench_disconnect_single(c: &mut Criterion) {
    let h = setup();
    let node_sw = StructuralWriter::<NODE_SLOT_SIZE>::new(&h.writer, &h.node_fl, NODE_START_OFFSET, NODE_CAPACITY);
    let synapse_sw = StructuralWriter::<SYNAPSE_SLOT_SIZE>::new(&h.writer, &h.synapse_fl, SYNAPSE_START_OFFSET, SYNAPSE_CAPACITY);
    let node_chain = NodeChainWriter::new(&h.writer, &node_sw, NODE_HEAD_OFFSET);
    let synapse_chain = SynapseChainWriter::new(&node_chain, &synapse_sw);

    let src = node_chain.insert_head(NodeDraft { opcode: 1, base_tick: 0 }).unwrap();
    let tgt = node_chain.insert_head(NodeDraft { opcode: 2, base_tick: 0 }).unwrap();

    c.bench_function("SynapseChain/disconnect_single", |b| {
        b.iter(|| {
            let syn = synapse_chain.connect(src, tgt, SynapseDraft { opcode: 10 }).unwrap();
            synapse_chain.disconnect(black_box(syn)).unwrap();
        });
    });
}

// ============ connect: append to growing outgoing chain ============

fn bench_connect_chain_growth(c: &mut Criterion) {
    let mut group = c.benchmark_group("SynapseChain/connect_chain_depth");

    for chain_depth in [1, 4, 16, 64, 128] {
        group.bench_with_input(
            BenchmarkId::from_parameter(chain_depth),
            &chain_depth,
            |b, &depth| {
                let h = setup();
                let node_sw = StructuralWriter::<NODE_SLOT_SIZE>::new(&h.writer, &h.node_fl, NODE_START_OFFSET, NODE_CAPACITY);
                let synapse_sw = StructuralWriter::<SYNAPSE_SLOT_SIZE>::new(&h.writer, &h.synapse_fl, SYNAPSE_START_OFFSET, SYNAPSE_CAPACITY);
                let node_chain = NodeChainWriter::new(&h.writer, &node_sw, NODE_HEAD_OFFSET);
                let synapse_chain = SynapseChainWriter::new(&node_chain, &synapse_sw);

                let src = node_chain.insert_head(NodeDraft { opcode: 1, base_tick: 0 }).unwrap();

                // pre-build the chain to `depth` targets
                let mut targets = Vec::with_capacity(depth);
                let mut synapses = Vec::with_capacity(depth);
                for i in 0..depth {
                    let tgt = node_chain.insert_head(NodeDraft { opcode: (i + 2) as i32, base_tick: 0 }).unwrap();
                    targets.push(tgt);
                    synapses.push(synapse_chain.connect(src, tgt, SynapseDraft { opcode: i as i32 }).unwrap());
                }

                // one more target for the benchmark connect
                let bench_tgt = node_chain.insert_head(NodeDraft { opcode: 99, base_tick: 0 }).unwrap();

                b.iter(|| {
                    let syn = synapse_chain.connect(
                        black_box(src), black_box(bench_tgt), SynapseDraft { opcode: black_box(99) }
                    ).unwrap();
                    synapse_chain.disconnect(syn).unwrap();
                });
            },
        );
    }
    group.finish();
}

// ============ disconnect: head of chain at various depths ============

fn bench_disconnect_head(c: &mut Criterion) {
    let mut group = c.benchmark_group("SynapseChain/disconnect_head_depth");

    for chain_depth in [2, 8, 32, 64] {
        group.bench_with_input(
            BenchmarkId::from_parameter(chain_depth),
            &chain_depth,
            |b, &depth| {
                b.iter_custom(|iters| {
                    let h = setup();
                    let node_sw = StructuralWriter::<NODE_SLOT_SIZE>::new(&h.writer, &h.node_fl, NODE_START_OFFSET, NODE_CAPACITY);
                    let synapse_sw = StructuralWriter::<SYNAPSE_SLOT_SIZE>::new(&h.writer, &h.synapse_fl, SYNAPSE_START_OFFSET, SYNAPSE_CAPACITY);
                    let node_chain = NodeChainWriter::new(&h.writer, &node_sw, NODE_HEAD_OFFSET);
                    let synapse_chain = SynapseChainWriter::new(&node_chain, &synapse_sw);

                    let src = node_chain.insert_head(NodeDraft { opcode: 1, base_tick: 0 }).unwrap();

                    let start = std::time::Instant::now();
                    for _ in 0..iters {
                        // build chain
                        let mut synapses = Vec::with_capacity(depth);
                        for i in 0..depth {
                            let tgt = node_chain.insert_head(NodeDraft { opcode: (i + 2) as i32, base_tick: 0 }).unwrap();
                            synapses.push(synapse_chain.connect(src, tgt, SynapseDraft { opcode: i as i32 }).unwrap());
                        }
                        // disconnect head (timed operation)
                        synapse_chain.disconnect(black_box(synapses[0])).unwrap();
                        // teardown: disconnect rest
                        for s in &synapses[1..] {
                            synapse_chain.disconnect(*s).unwrap();
                        }
                        // free target nodes
                        // (nodes allocated in this iter get freed for next iter)
                        for _ in 0..depth {
                            // remove nodes from chain to free slots
                            if let Some(head) = node_chain.get_head() {
                                let head_next = head.get_next_ptr();
                                if head_next != src {
                                    node_chain.remove(head_next).ok();
                                }
                            }
                        }
                    }
                    start.elapsed()
                });
            },
        );
    }
    group.finish();
}

// ============ connect + disconnect cycle (throughput) ============

fn bench_connect_disconnect_throughput(c: &mut Criterion) {
    let h = setup();
    let node_sw = StructuralWriter::<NODE_SLOT_SIZE>::new(&h.writer, &h.node_fl, NODE_START_OFFSET, NODE_CAPACITY);
    let synapse_sw = StructuralWriter::<SYNAPSE_SLOT_SIZE>::new(&h.writer, &h.synapse_fl, SYNAPSE_START_OFFSET, SYNAPSE_CAPACITY);
    let node_chain = NodeChainWriter::new(&h.writer, &node_sw, NODE_HEAD_OFFSET);
    let synapse_chain = SynapseChainWriter::new(&node_chain, &synapse_sw);

    let src = node_chain.insert_head(NodeDraft { opcode: 1, base_tick: 0 }).unwrap();
    let tgt = node_chain.insert_head(NodeDraft { opcode: 2, base_tick: 0 }).unwrap();

    c.bench_function("SynapseChain/connect_disconnect_cycle", |b| {
        b.iter(|| {
            let s = synapse_chain.connect(
                black_box(src), black_box(tgt), SynapseDraft { opcode: black_box(7) }
            ).unwrap();
            synapse_chain.disconnect(black_box(s)).unwrap();
        });
    });
}

// ============ get + read all fields ============

fn bench_synapse_read_all_fields(c: &mut Criterion) {
    let h = setup();
    let node_sw = StructuralWriter::<NODE_SLOT_SIZE>::new(&h.writer, &h.node_fl, NODE_START_OFFSET, NODE_CAPACITY);
    let synapse_sw = StructuralWriter::<SYNAPSE_SLOT_SIZE>::new(&h.writer, &h.synapse_fl, SYNAPSE_START_OFFSET, SYNAPSE_CAPACITY);
    let node_chain = NodeChainWriter::new(&h.writer, &node_sw, NODE_HEAD_OFFSET);
    let synapse_chain = SynapseChainWriter::new(&node_chain, &synapse_sw);

    let src = node_chain.insert_head(NodeDraft { opcode: 1, base_tick: 0 }).unwrap();
    let tgt = node_chain.insert_head(NodeDraft { opcode: 2, base_tick: 0 }).unwrap();
    let syn = synapse_chain.connect(src, tgt, SynapseDraft { opcode: 42 }).unwrap();

    c.bench_function("SynapseChain/get_read_all_fields", |b| {
        b.iter(|| {
            let s = synapse_chain.get(black_box(syn));
            black_box(s.get_opcode());
            black_box(s.get_source_ptr());
            black_box(s.get_target_ptr());
            black_box(s.get_outgoing_next_ptr());
            black_box(s.get_outgoing_prev_ptr());
            black_box(s.get_incoming_next_ptr());
            black_box(s.get_incoming_prev_ptr());
        });
    });
}

// ============ publish + reader traversal ============

fn bench_reader_traversal(c: &mut Criterion) {
    let mut group = c.benchmark_group("SynapseChain/reader_traversal");

    for chain_size in [4, 16, 64, 256] {
        group.bench_with_input(
            BenchmarkId::from_parameter(chain_size),
            &chain_size,
            |b, &size| {
                let mut h = setup();

                {
                    let node_sw = StructuralWriter::<NODE_SLOT_SIZE>::new(&h.writer, &h.node_fl, NODE_START_OFFSET, NODE_CAPACITY);
                    let synapse_sw = StructuralWriter::<SYNAPSE_SLOT_SIZE>::new(&h.writer, &h.synapse_fl, SYNAPSE_START_OFFSET, SYNAPSE_CAPACITY);
                    let node_chain = NodeChainWriter::new(&h.writer, &node_sw, NODE_HEAD_OFFSET);
                    let synapse_chain = SynapseChainWriter::new(&node_chain, &synapse_sw);

                    let src = node_chain.insert_head(NodeDraft { opcode: 1, base_tick: 0 }).unwrap();

                    for i in 0..size {
                        let tgt = node_chain.insert_head(NodeDraft { opcode: (i + 2) as i32, base_tick: 0 }).unwrap();
                        synapse_chain.connect(src, tgt, SynapseDraft { opcode: i as i32 }).unwrap();
                    }
                }
                h.writer.publish();
                h.reader.swap();

                let node_sr = StructuralReader::<NODE_SLOT_SIZE>::new(&h.reader, NODE_START_OFFSET, NODE_CAPACITY);
                let synapse_sr = StructuralReader::<SYNAPSE_SLOT_SIZE>::new(&h.reader, SYNAPSE_START_OFFSET, SYNAPSE_CAPACITY);
                let node_chain_r = NodeChainReader::new(&h.reader, &node_sr, NODE_HEAD_OFFSET);
                let synapse_chain_r = SynapseChainReader::new(&synapse_sr);

                // find the source node (it was inserted first, so it's somewhere in the node chain)
                // We know its outgoing head is the first synapse
                // For the bench, we pre-find the outgoing head and traverse from there
                let head_node = node_chain_r.get_head().unwrap();
                // Walk to find a node with outgoing synapses
                let mut cursor_slot = 0;
                let mut cur = node_chain_r.get_head();
                while let Some(n) = &cur {
                    if n.get_outgoing_synapse_head() != 0 {
                        cursor_slot = n.get_outgoing_synapse_head();
                        break;
                    }
                    let next = n.get_next_ptr();
                    if next == 0 { break; }
                    cur = Some(node_chain_r.get(next));
                }

                b.iter(|| {
                    let mut ptr = cursor_slot;
                    let mut count = 0u32;
                    while ptr != 0 {
                        let s = synapse_chain_r.get(black_box(ptr));
                        black_box(s.get_opcode());
                        ptr = s.get_outgoing_next_ptr();
                        count += 1;
                    }
                    black_box(count);
                });
            },
        );
    }
    group.finish();
}

// ============ self-loop connect + disconnect ============

fn bench_self_loop_cycle(c: &mut Criterion) {
    let h = setup();
    let node_sw = StructuralWriter::<NODE_SLOT_SIZE>::new(&h.writer, &h.node_fl, NODE_START_OFFSET, NODE_CAPACITY);
    let synapse_sw = StructuralWriter::<SYNAPSE_SLOT_SIZE>::new(&h.writer, &h.synapse_fl, SYNAPSE_START_OFFSET, SYNAPSE_CAPACITY);
    let node_chain = NodeChainWriter::new(&h.writer, &node_sw, NODE_HEAD_OFFSET);
    let synapse_chain = SynapseChainWriter::new(&node_chain, &synapse_sw);

    let n = node_chain.insert_head(NodeDraft { opcode: 1, base_tick: 0 }).unwrap();

    c.bench_function("SynapseChain/self_loop_cycle", |b| {
        b.iter(|| {
            let s = synapse_chain.connect(
                black_box(n), black_box(n), SynapseDraft { opcode: black_box(99) }
            ).unwrap();
            synapse_chain.disconnect(black_box(s)).unwrap();
        });
    });
}

// ============ publish latency ============

fn bench_publish_after_mutations(c: &mut Criterion) {
    c.bench_function("SynapseChain/publish_after_32_connects", |b| {
        b.iter_custom(|iters| {
            let mut total = std::time::Duration::ZERO;
            for _ in 0..iters {
                let mut h = setup();
                {
                    let node_sw = StructuralWriter::<NODE_SLOT_SIZE>::new(&h.writer, &h.node_fl, NODE_START_OFFSET, NODE_CAPACITY);
                    let synapse_sw = StructuralWriter::<SYNAPSE_SLOT_SIZE>::new(&h.writer, &h.synapse_fl, SYNAPSE_START_OFFSET, SYNAPSE_CAPACITY);
                    let node_chain = NodeChainWriter::new(&h.writer, &node_sw, NODE_HEAD_OFFSET);
                    let synapse_chain = SynapseChainWriter::new(&node_chain, &synapse_sw);

                    let src = node_chain.insert_head(NodeDraft { opcode: 1, base_tick: 0 }).unwrap();
                    for i in 0..32 {
                        let tgt = node_chain.insert_head(NodeDraft { opcode: (i + 2) as i32, base_tick: 0 }).unwrap();
                        synapse_chain.connect(src, tgt, SynapseDraft { opcode: i }).unwrap();
                    }
                }
                let start = std::time::Instant::now();
                h.writer.publish();
                total += start.elapsed();
            }
            total
        });
    });
}

criterion_group!(
    benches,
    bench_connect_single,
    bench_disconnect_single,
    bench_connect_disconnect_throughput,
    bench_synapse_read_all_fields,
    bench_self_loop_cycle,
    bench_connect_chain_growth,
    bench_disconnect_head,
    bench_reader_traversal,
    bench_publish_after_mutations,
);
criterion_main!(benches);
