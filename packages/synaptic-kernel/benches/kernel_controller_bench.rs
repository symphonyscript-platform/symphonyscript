use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};
use synaptic_kernel::control_plane::ControlPlane;
use synaptic_kernel::kernel::Kernel;
use synaptic_kernel::synaptic_graph_config::SynapticGraphConfig;
const NODE_META: usize = 8;
const NODE_ATTR: usize = 16;
const SYNAPSE_META: usize = 8;
const SYNAPSE_ATTR: usize = 16;

type TestKernel = Kernel<NODE_META, NODE_ATTR, SYNAPSE_META, SYNAPSE_ATTR>;
fn config(cap: usize) -> SynapticGraphConfig {
    SynapticGraphConfig {
        node_capacity: cap,
        synapse_capacity: cap,
        mem_metadata_size: 1,
        tb_metadata_size: 1,
    }
}

fn new_controller(cfg: SynapticGraphConfig) -> TestKernel {
    Kernel::new(cfg)
}

// ============ insert_head latency ============

fn bench_insert_head(c: &mut Criterion) {
    c.bench_function("Kernel/insert_head", |b| {
        b.iter_custom(|iters| {
            let mut controller = new_controller(config(iters as usize + 16));
            let start = std::time::Instant::now();
            for i in 0..iters {
                controller.insert_head(black_box(i as i32)).unwrap();
            }
            start.elapsed()
        });
    });
}

// ============ insert_after latency (mid-chain) ============

fn bench_insert_after(c: &mut Criterion) {
    c.bench_function("Kernel/insert_after", |b| {
        b.iter_custom(|iters| {
            let mut controller = new_controller(config(iters as usize + 16));
            let anchor = controller.insert_head(0).unwrap();
            let start = std::time::Instant::now();
            for i in 0..iters {
                controller
                    .insert_after(anchor, black_box(i as i32))
                    .unwrap();
            }
            start.elapsed()
        });
    });
}

// ============ connect + disconnect cycle ============

fn bench_connect_disconnect(c: &mut Criterion) {
    c.bench_function("Kernel/connect_disconnect_cycle", |b| {
        b.iter_custom(|iters| {
            let mut controller = new_controller(config(1024));
            let n1 = controller.insert_head(1).unwrap();
            let n2 = controller.insert_after(n1, 2).unwrap();

            let start = std::time::Instant::now();
            for i in 0..iters {
                let s = controller.connect(n1, n2, 1).unwrap();
                controller.disconnect(s).unwrap();
                if i % 512 == 511 {
                    controller.publish(); // flushes deferred frees
                }
            }
            start.elapsed()
        });
    });
}

// ============ publish latency (empty) ============

fn bench_publish_empty(c: &mut Criterion) {
    let mut controller = new_controller(config(16));
    c.bench_function("Kernel/publish_empty", |b| {
        b.iter(|| {
            controller.publish();
        });
    });
}

// ============ publish latency after N mutations ============

fn bench_publish_after_mutations(c: &mut Criterion) {
    let mut group = c.benchmark_group("Kernel/publish_after_mutations");

    for count in [8, 32, 128] {
        group.bench_with_input(
            BenchmarkId::from_parameter(count),
            &count,
            |b, &n| {
                b.iter_custom(|iters| {
                    let mut total = std::time::Duration::ZERO;
                    for _ in 0..iters {
                        let mut controller = new_controller(config(n + 16));
                        let head = controller.insert_head(0).unwrap();
                        for i in 1..n {
                            controller.insert_after(head, i as i32).unwrap();
                        }
                        let start = std::time::Instant::now();
                        controller.publish();
                        total += start.elapsed();
                    }
                    total
                });
            },
        );
    }
    group.finish();
}

// ============ publish + swap cycle ============

fn bench_publish_swap_cycle(c: &mut Criterion) {
    c.bench_function("Kernel/publish_swap_cycle", |b| {
        b.iter_custom(|iters| {
            let mut controller = new_controller(config(64));
            let cp_addr = controller.get_controller_plane_address();
            let cp_ptr = cp_addr as *const ControlPlane<NODE_META, NODE_ATTR, SYNAPSE_META, SYNAPSE_ATTR>;

            // Seed data
            let n1 = controller.insert_head(1).unwrap();
            controller.insert_after(n1, 2).unwrap();
            controller.publish();

            let start = std::time::Instant::now();
            for i in 0..iters {
                controller.set_node_attribute(n1, 0, black_box(i as i32));
                controller.publish();
                let reader = unsafe {
                    let reader_ptr = (*cp_ptr).get_shared_graph_ptr();
                    &mut *reader_ptr
                };
                reader.swap();
            }
            start.elapsed()
        });
    });
}

// ============ node attribute write latency ============

fn bench_set_node_attribute(c: &mut Criterion) {
    let mut controller = new_controller(config(16));
    let n1 = controller.insert_head(1).unwrap();

    c.bench_function("Kernel/set_node_attribute", |b| {
        b.iter(|| {
            controller.set_node_attribute(n1, black_box(0), black_box(42));
        });
    });
}

// ============ node attribute read latency ============

fn bench_get_node_attribute(c: &mut Criterion) {
    let mut controller = new_controller(config(16));
    let n1 = controller.insert_head(1).unwrap();
    controller.set_node_attribute(n1, 0, 42);

    c.bench_function("Kernel/get_node_attribute", |b| {
        b.iter(|| {
            black_box(controller.get_node_attribute(n1, black_box(0)));
        });
    });
}

// ============ audio thread traversal latency ============

fn bench_audio_traversal(c: &mut Criterion) {
    let mut group = c.benchmark_group("Kernel/audio_traversal");

    for chain_size in [4, 16, 64, 256] {
        group.bench_with_input(
            BenchmarkId::from_parameter(chain_size),
            &chain_size,
            |b, &size| {
                let mut controller = new_controller(config(size + 16));
                let cp_addr = controller.get_controller_plane_address();
                let cp_ptr = cp_addr as *const ControlPlane<NODE_META, NODE_ATTR, SYNAPSE_META, SYNAPSE_ATTR>;

                let mut prev = controller.insert_head(0).unwrap();
                for i in 1..size {
                    prev = controller.insert_after(prev, i as i32).unwrap();
                }
                controller.publish();

                let reader = unsafe {
                    let reader_ptr = (*cp_ptr).get_shared_graph_ptr();
                    &mut *reader_ptr
                };
                reader.swap();

                b.iter(|| {
                    let mut current = reader.get_head_node();
                    let mut count = 0u32;
                    while let Some(node) = current {
                        black_box(node.get_kind());
                        let next = node.get_next_ptr();
                        if next == 0 {
                            break;
                        }
                        current = Some(reader.get_node(next));
                        count += 1;
                    }
                    black_box(count);
                });
            },
        );
    }
    group.finish();
}

// ============ grow latency (empty kernel) ============

fn bench_grow_empty(c: &mut Criterion) {
    let mut group = c.benchmark_group("Kernel/grow_empty");

    for (from, to) in [(16, 32), (64, 128), (256, 512), (1024, 2048)] {
        group.bench_with_input(
            BenchmarkId::from_parameter(format!("{}→{}", from, to)),
            &(from, to),
            |b, &(from_cap, to_cap)| {
                b.iter_custom(|iters| {
                    let mut total = std::time::Duration::ZERO;
                    for _ in 0..iters {
                        let mut controller = new_controller(config(from_cap));
                        let start = std::time::Instant::now();
                        controller.grow(config(to_cap)).unwrap();
                        total += start.elapsed();
                    }
                    total
                });
            },
        );
    }
    group.finish();
}

// ============ grow latency (loaded kernel) ============

fn bench_grow_loaded(c: &mut Criterion) {
    let mut group = c.benchmark_group("Kernel/grow_loaded");

    for (from, to, fill) in [(32, 64, 24), (128, 256, 100), (512, 1024, 400)] {
        group.bench_with_input(
            BenchmarkId::from_parameter(format!("{}→{}_fill{}", from, to, fill)),
            &(from, to, fill),
            |b, &(from_cap, to_cap, fill_count)| {
                b.iter_custom(|iters| {
                    let mut total = std::time::Duration::ZERO;
                    for _ in 0..iters {
                        let mut controller = new_controller(config(from_cap));
                        let head = controller.insert_head(0).unwrap();
                        let mut prev = head;
                        for i in 1..fill_count {
                            prev = controller.insert_after(prev, i as i32).unwrap();
                        }
                        // Connect some synapses from head to next
                        let next_slot = controller.get_node(head).get_next_ptr();
                        if next_slot != 0 {
                            for i in 0..fill_count.min(from_cap - fill_count - 1) {
                                controller.connect(head, next_slot, i as i32).unwrap();
                            }
                        }
                        controller.publish();

                        let start = std::time::Instant::now();
                        controller.grow(config(to_cap)).unwrap();
                        total += start.elapsed();
                    }
                    total
                });
            },
        );
    }
    group.finish();
}

// ============ grow + publish + swap end-to-end ============

fn bench_grow_publish_swap(c: &mut Criterion) {
    c.bench_function("Kernel/grow_publish_swap_e2e", |b| {
        b.iter_custom(|iters| {
            let mut total = std::time::Duration::ZERO;
            for _ in 0..iters {
                let mut controller = new_controller(config(32));
                let cp_addr = controller.get_controller_plane_address();
                let cp_ptr = cp_addr as *const ControlPlane<NODE_META, NODE_ATTR, SYNAPSE_META, SYNAPSE_ATTR>;

                let n1 = controller.insert_head(1).unwrap();
                controller.insert_after(n1, 2).unwrap();
                controller.publish();

                let reader = unsafe {
                    let reader_ptr = (*cp_ptr).get_shared_graph_ptr();
                    &mut *reader_ptr
                };
                reader.swap();

                let start = std::time::Instant::now();
                controller.grow(config(64)).unwrap();
                controller.publish();
                // Re-load pointer after grow
                let reader = unsafe {
                    let reader_ptr = (*cp_ptr).get_shared_graph_ptr();
                    &mut *reader_ptr
                };
                reader.swap();
                // Traverse to verify
                let mut current = reader.get_head_node();
                while let Some(node) = current {
                    black_box(node.get_kind());
                    let next = node.get_next_ptr();
                    if next == 0 {
                        break;
                    }
                    current = Some(reader.get_node(next));
                }
                total += start.elapsed();
            }
            total
        });
    });
}

// ============ consecutive grows ============

fn bench_consecutive_grows(c: &mut Criterion) {
    c.bench_function("Kernel/consecutive_grows_16_to_256", |b| {
        b.iter_custom(|iters| {
            let mut total = std::time::Duration::ZERO;
            for _ in 0..iters {
                let mut controller = new_controller(config(16));
                controller.insert_head(1).unwrap();

                let start = std::time::Instant::now();
                controller.grow(config(32)).unwrap();
                controller.publish();
                controller.grow(config(64)).unwrap();
                controller.publish();
                controller.grow(config(128)).unwrap();
                controller.publish();
                controller.grow(config(256)).unwrap();
                controller.publish();
                total += start.elapsed();
            }
            total
        });
    });
}

// ============ full mutation cycle throughput ============

fn bench_full_mutation_cycle(c: &mut Criterion) {
    c.bench_function("Kernel/full_cycle_insert_connect_publish_swap", |b| {
        b.iter_custom(|iters| {
            let mut controller = new_controller(config(iters as usize * 2 + 16));
            let cp_addr = controller.get_controller_plane_address();
            let cp_ptr = cp_addr as *const ControlPlane<NODE_META, NODE_ATTR, SYNAPSE_META, SYNAPSE_ATTR>;

            let start = std::time::Instant::now();
            for i in 0..iters {
                let n1 = controller.insert_head(i as i32).unwrap();
                let n2 = controller.insert_head((i + 1000) as i32).unwrap();
                controller.connect(n1, n2, i as i32).unwrap();
                controller.set_node_attribute(n1, 0, i as i32);

                if i % 64 == 63 {
                    controller.publish();
                    unsafe {
                        let reader_ptr = (*cp_ptr).get_shared_graph_ptr();
                        (&mut *reader_ptr).swap();
                    }
                }
            }
            controller.publish();
            start.elapsed()
        });
    });
}

criterion_group!(
    benches,
    bench_insert_head,
    bench_insert_after,
    bench_connect_disconnect,
    bench_publish_empty,
    bench_publish_after_mutations,
    bench_publish_swap_cycle,
    bench_set_node_attribute,
    bench_get_node_attribute,
    bench_audio_traversal,
    bench_grow_empty,
    bench_grow_loaded,
    bench_grow_publish_swap,
    bench_consecutive_grows,
    bench_full_mutation_cycle,
);
criterion_main!(benches);
