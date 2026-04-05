use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use std::sync::Arc;
use std::sync::atomic::AtomicI32;
use synaptic_kernel::constants::{NODE_SLOT_SIZE, SYNAPSE_SIZE};
use synaptic_kernel::primitives::types::AtomicBuffer;
use synaptic_kernel::primitives::triple_buffer::TripleBuffer;
use synaptic_kernel::topology::node::node_chain_writer::NodeChainWriter;
use synaptic_kernel::topology::node::node_chain_reader::NodeChainReader;
use synaptic_kernel::topology::synapse::synapse_chain_writer::SynapseChainWriter;
use synaptic_kernel::topology::synapse::synapse_chain_reader::SynapseChainReader;

fn create_mem(size: usize) -> AtomicBuffer {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

const MEM_SIZE: usize = 262144;
const TB_START: usize = 0;
const TB_BUF_CAP: usize = 65536;
const NODE_CAPACITY: usize = 512;
const SYNAPSE_CAPACITY: usize = 2048;
const NODE_TB_OFFSET: usize = 0;
const NODE_FL_START: usize = 200000;
const SYNAPSE_FL_START: usize = 210000;
const FLUSH_INTERVAL: u64 = 512;

struct Harness {
    mem: AtomicBuffer,
    writer: synaptic_kernel::primitives::triple_buffer::TripleBufferWriter,
    reader: synaptic_kernel::primitives::triple_buffer::TripleBufferReader,
}

fn setup() -> Harness {
    let mem = create_mem(MEM_SIZE);
    let (writer, reader) = TripleBuffer::new(Arc::clone(&mem), TB_START, TB_BUF_CAP);
    Harness { mem, writer, reader }
}

fn synapse_tb_offset() -> usize {
    NODE_TB_OFFSET + 1 + NODE_CAPACITY * NODE_SLOT_SIZE
}

fn make_chains(h: &Harness) -> (NodeChainWriter, SynapseChainWriter) {
    let node_chain = NodeChainWriter::new(
        Arc::clone(&h.mem),
        h.writer.clone(),
        NODE_FL_START,
        NODE_TB_OFFSET,
        NODE_CAPACITY,
    );
    let synapse_chain = SynapseChainWriter::new(
        Arc::clone(&h.mem),
        h.writer.clone(),
        node_chain.clone(),
        SYNAPSE_FL_START,
        synapse_tb_offset(),
        SYNAPSE_CAPACITY,
    );
    (node_chain, synapse_chain)
}

// ============ connect: single synapse ============

fn bench_connect_single(c: &mut Criterion) {
    c.bench_function("SynapseChain/connect_single", |b| {
        b.iter_custom(|iters| {
            let h = setup();
            let (node_chain, mut synapse_chain) = make_chains(&h);
            let src = node_chain.insert_head(NodeDraft { kind: 1, base_tick: 0 }).unwrap();
            let tgt = node_chain.insert_head(NodeDraft { kind: 2, base_tick: 0 }).unwrap();

            let start = std::time::Instant::now();
            for i in 0..iters {
                let syn = synapse_chain.connect(
                    black_box(src), black_box(tgt), SynapseDraft { opcode: black_box(10) }
                ).unwrap();
                synapse_chain.disconnect(syn).unwrap();
                if i % FLUSH_INTERVAL == FLUSH_INTERVAL - 1 {
                    synapse_chain.flush_deferred();
                }
            }
            start.elapsed()
        });
    });
}

// ============ disconnect: single synapse ============

fn bench_disconnect_single(c: &mut Criterion) {
    c.bench_function("SynapseChain/disconnect_single", |b| {
        b.iter_custom(|iters| {
            let h = setup();
            let (node_chain, mut synapse_chain) = make_chains(&h);
            let src = node_chain.insert_head(NodeDraft { kind: 1, base_tick: 0 }).unwrap();
            let tgt = node_chain.insert_head(NodeDraft { kind: 2, base_tick: 0 }).unwrap();

            let start = std::time::Instant::now();
            for i in 0..iters {
                let syn = synapse_chain.connect(src, tgt, SynapseDraft { opcode: 10 }).unwrap();
                synapse_chain.disconnect(black_box(syn)).unwrap();
                if i % FLUSH_INTERVAL == FLUSH_INTERVAL - 1 {
                    synapse_chain.flush_deferred();
                }
            }
            start.elapsed()
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
                b.iter_custom(|iters| {
                    let h = setup();
                    let (node_chain, mut synapse_chain) = make_chains(&h);
                    let src = node_chain.insert_head(NodeDraft { kind: 1, base_tick: 0 }).unwrap();

                    for i in 0..depth {
                        let tgt = node_chain.insert_head(NodeDraft { kind: (i + 2) as i32, base_tick: 0 }).unwrap();
                        synapse_chain.connect(src, tgt, SynapseDraft { opcode: i as i32 }).unwrap();
                    }

                    let bench_tgt = node_chain.insert_head(NodeDraft { kind: 99, base_tick: 0 }).unwrap();

                    let start = std::time::Instant::now();
                    for i in 0..iters {
                        let syn = synapse_chain.connect(
                            black_box(src), black_box(bench_tgt), SynapseDraft { opcode: black_box(99) }
                        ).unwrap();
                        synapse_chain.disconnect(syn).unwrap();
                        if i % FLUSH_INTERVAL == FLUSH_INTERVAL - 1 {
                            synapse_chain.flush_deferred();
                        }
                    }
                    start.elapsed()
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
                    let (mut node_chain, mut synapse_chain) = make_chains(&h);
                    let src = node_chain.insert_head(NodeDraft { kind: 1, base_tick: 0 }).unwrap();

                    let start = std::time::Instant::now();
                    for _ in 0..iters {
                        let mut synapses = Vec::with_capacity(depth);
                        for i in 0..depth {
                            let tgt = node_chain.insert_head(NodeDraft { kind: (i + 2) as i32, base_tick: 0 }).unwrap();
                            synapses.push(synapse_chain.connect(src, tgt, SynapseDraft { opcode: i as i32 }).unwrap());
                        }
                        synapse_chain.disconnect(black_box(synapses[0])).unwrap();
                        for s in &synapses[1..] {
                            synapse_chain.disconnect(*s).unwrap();
                        }
                        synapse_chain.flush_deferred();
                        for _ in 0..depth {
                            if let Some(head) = node_chain.get_head() {
                                let head_next = head.get_next_ptr();
                                if head_next != src {
                                    node_chain.remove(head_next).ok();
                                }
                            }
                        }
                        node_chain.flush_deferred();
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
    c.bench_function("SynapseChain/connect_disconnect_cycle", |b| {
        b.iter_custom(|iters| {
            let h = setup();
            let (node_chain, mut synapse_chain) = make_chains(&h);
            let src = node_chain.insert_head(NodeDraft { kind: 1, base_tick: 0 }).unwrap();
            let tgt = node_chain.insert_head(NodeDraft { kind: 2, base_tick: 0 }).unwrap();

            let start = std::time::Instant::now();
            for i in 0..iters {
                let s = synapse_chain.connect(
                    black_box(src), black_box(tgt), SynapseDraft { opcode: black_box(7) }
                ).unwrap();
                synapse_chain.disconnect(black_box(s)).unwrap();
                if i % FLUSH_INTERVAL == FLUSH_INTERVAL - 1 {
                    synapse_chain.flush_deferred();
                }
            }
            start.elapsed()
        });
    });
}

// ============ get + read all fields ============

fn bench_synapse_read_all_fields(c: &mut Criterion) {
    let h = setup();
    let (node_chain, synapse_chain) = make_chains(&h);

    let src = node_chain.insert_head(NodeDraft { kind: 1, base_tick: 0 }).unwrap();
    let tgt = node_chain.insert_head(NodeDraft { kind: 2, base_tick: 0 }).unwrap();
    let syn = synapse_chain.connect(src, tgt, SynapseDraft { opcode: 42 }).unwrap();

    c.bench_function("SynapseChain/get_read_all_fields", |b| {
        b.iter(|| {
            let s = synapse_chain.get_synapse(black_box(syn));
            black_box(s.get_kind());
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
                    let (node_chain, synapse_chain) = make_chains(&h);
                    let src = node_chain.insert_head(NodeDraft { kind: 1, base_tick: 0 }).unwrap();

                    for i in 0..size {
                        let tgt = node_chain.insert_head(NodeDraft { kind: (i + 2) as i32, base_tick: 0 }).unwrap();
                        synapse_chain.connect(src, tgt, SynapseDraft { opcode: i as i32 }).unwrap();
                    }
                }
                h.writer.publish();
                h.reader.swap();

                let node_chain_r = NodeChainReader::bind(
                    h.reader.clone(),
                    NODE_TB_OFFSET,
                    NODE_CAPACITY,
                );
                let synapse_chain_r = SynapseChainReader::bind(
                    h.reader.clone(),
                    synapse_tb_offset(),
                    SYNAPSE_CAPACITY,
                );

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
                        black_box(s.get_kind());
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
    c.bench_function("SynapseChain/self_loop_cycle", |b| {
        b.iter_custom(|iters| {
            let h = setup();
            let (node_chain, mut synapse_chain) = make_chains(&h);
            let n = node_chain.insert_head(NodeDraft { kind: 1, base_tick: 0 }).unwrap();

            let start = std::time::Instant::now();
            for i in 0..iters {
                let s = synapse_chain.connect(
                    black_box(n), black_box(n), SynapseDraft { opcode: black_box(99) }
                ).unwrap();
                synapse_chain.disconnect(black_box(s)).unwrap();
                if i % FLUSH_INTERVAL == FLUSH_INTERVAL - 1 {
                    synapse_chain.flush_deferred();
                }
            }
            start.elapsed()
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
                    let (node_chain, synapse_chain) = make_chains(&h);
                    let src = node_chain.insert_head(NodeDraft { kind: 1, base_tick: 0 }).unwrap();
                    for i in 0..32 {
                        let tgt = node_chain.insert_head(NodeDraft { kind: (i + 2) as i32, base_tick: 0 }).unwrap();
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
