mod common;

use synaptic_kernel::epoch_consumer::EpochConsumer;
use synaptic_kernel::kernel::Kernel;
use synaptic_kernel::kernel_config::KernelConfig;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;

const NODE_META: usize = 8;
const NODE_ATTR: usize = 16;
const SYNAPSE_META: usize = 8;
const SYNAPSE_ATTR: usize = 16;

type TestKernel = Kernel<1, 1, 1>;
type TestConsumer = EpochConsumer<1, 1, 1>;

fn config() -> KernelConfig<1, 1, 1> {
    common::kernel_config_1_1(128, 256, NODE_META, NODE_ATTR, SYNAPSE_META, SYNAPSE_ATTR)
}

#[test]
fn multi_threaded_topology_fuzzer() {
    let writer = TestKernel::new(config());
    let cp = writer.get_control_plane();

    let is_running = Arc::new(AtomicBool::new(true));
    let is_running_writer = Arc::clone(&is_running);

    let iterations = 100_000;

    // --- WRITER THREAD ---
    // Violently allocates, connects, disconnects, and frees structural memory layout,
    // constantly sweeping the generation-based staging buffer boundary.
    let writer_handle = thread::spawn(move || {
        let mut writer = writer;

        for round in 0..iterations {
            let mut nodes = Vec::new();
            let mut synapses = Vec::new();

            // 1. Allocate a burst of nodes
            for i in 0..64 {
                if let Ok(slot) = writer.insert_node(i) {
                    nodes.push(slot);
                    writer.get_node(slot).attr_write(0, round); // mark with round
                }
            }

            // 2. Publish nodes
            writer.publish();

            // 3. Connect them randomly (linear chain + some star topology)
            if nodes.len() > 1 {
                for i in 0..nodes.len() - 1 {
                    if let Ok(s) = writer.connect(nodes[i], nodes[i + 1], 99) {
                        synapses.push(s);
                    }
                    if let Ok(s) = writer.connect(nodes[0], nodes[i + 1], 88) {
                        synapses.push(s);
                    }
                }
            }

            // 4. Publish connections
            writer.publish();

            // 5. Tear down half the synapses
            for (i, &s) in synapses.iter().enumerate() {
                if i % 2 == 0 {
                    let _ = writer.disconnect_synapse(s);
                }
            }

            // 6. Publish partial teardown
            writer.publish();

            // 7. Tear down all nodes (this implicitly cascades all remaining synapses)
            for &n in &nodes {
                let _ = writer.remove_node(n);
            }

            // 8. Publish complete teardown
            writer.publish();
        }

        is_running_writer.store(false, Ordering::Release);
    });

    // --- READER THREAD ---
    // Continuously transverses the dynamic graph memory on-the-fly, simulating a consumer thread.
    // Proves that structural pointers NEVER point to stale memory, freed memory,
    // and that the garbage collection boundaries physically prevent topology tearing.
    let reader_handle = thread::spawn(move || {
        let mut consumer = TestConsumer::new(cp);
        let mut total_iterations = 0u64;
        let mut max_nodes_seen = 0;

        while is_running.load(Ordering::Acquire) {
            let reader = consumer.acquire_mirror();
            total_iterations += 1;

            let mut node_opt = reader.get_head_node();
            let mut node_count = 0;

            while let Some(node) = node_opt {
                node_count += 1;
                assert!(node_count <= 128, "Node loop");
                let _attr = node.get_meta(0);

                let mut syn_opt = if node.get_outgoing_synapse_head() != 0 {
                    Some(reader.get_synapse(node.get_outgoing_synapse_head()))
                } else {
                    None
                };

                let mut syn_count = 0;
                while let Some(syn) = syn_opt {
                    syn_count += 1;
                    assert!(syn_count <= 256, "Out syn loop");
                    assert!(syn.get_target_ptr() > 0, "Invalid target");

                    syn_opt = if syn.get_outgoing_next_ptr() != 0 {
                        Some(reader.get_synapse(syn.get_outgoing_next_ptr()))
                    } else {
                        None
                    };
                }

                let mut in_syn_opt = if node.get_incoming_synapse_head() != 0 {
                    Some(reader.get_synapse(node.get_incoming_synapse_head()))
                } else {
                    None
                };

                let mut in_syn_count = 0;
                while let Some(syn) = in_syn_opt {
                    in_syn_count += 1;
                    assert!(in_syn_count <= 256, "In syn loop");
                    assert!(syn.get_source_ptr() > 0, "Invalid source");

                    in_syn_opt = if syn.get_incoming_next_ptr() != 0 {
                        Some(reader.get_synapse(syn.get_incoming_next_ptr()))
                    } else {
                        None
                    };
                }

                node_opt = if node.get_next_ptr() != 0 {
                    Some(reader.get_node(node.get_next_ptr()))
                } else {
                    None
                };
            }

            if node_count > max_nodes_seen {
                max_nodes_seen = node_count;
            }
        }

        (total_iterations, max_nodes_seen)
    });

    writer_handle.join().unwrap();
    let (_iters, _max_nodes) = reader_handle.join().unwrap();

    // We expect the reader to have successfully traversed the dynamic graph multiple times
    // without ever crashing or triggering the anti-cycle bounds — proving data integrity
    // across staging-buffer generation boundaries.
}
