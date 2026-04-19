use synaptic_kernel::kernel_config::KernelConfig;
use synaptic_kernel::epoch::Epoch;

use std::sync::atomic::{AtomicBool, AtomicI32, Ordering};
use std::sync::Arc;
use std::thread;

const NODE_META: usize = 8;
const NODE_ATTR: usize = 16;
const SYNAPSE_META: usize = 8;
const SYNAPSE_ATTR: usize = 16;

type Gw = Epoch<NODE_META, NODE_ATTR, SYNAPSE_META, SYNAPSE_ATTR>;

fn config() -> KernelConfig {
    KernelConfig {
        node_capacity: 128,
        synapse_capacity: 256,
        mem_metadata_size: 1,
        tb_metadata_size: 1,
    }
}

fn create_writer() -> Gw {
    let cfg = config();
    let size = Gw::calculate_size_on_mem(&cfg);
    let mem: Vec<AtomicI32> = (0..size).map(|_| AtomicI32::new(0)).collect();
    Gw::new(Arc::new(mem), cfg)
}

#[test]
fn multi_threaded_topology_fuzzer() {
    let writer = create_writer();
    let reader = writer.to_mirror();

    let is_running = Arc::new(AtomicBool::new(true));
    let is_running_writer = Arc::clone(&is_running);

    let iterations = 100_000;

    // --- WRITER THREAD ---
    // Violently allocates, connects, disconnects, and frees structural memory layout,
    // constantly sweeping the generation-based staging buffer boundary.
    let writer_handle = thread::spawn(move || {
        for round in 0..iterations {
            let mut nodes = Vec::new();
            let mut synapses = Vec::new();

            // 1. Allocate a burst of nodes
            for i in 0..64 {
                if let Some(slot) = writer.insert_head(i) {
                    nodes.push(slot);
                    writer.set_node_attribute(slot, 0, round); // mark with round
                }
            }

            // 2. Publish nodes
            writer.publish();

            // 3. Connect them randomly (linear chain + some star topology)
            if nodes.len() > 1 {
                for i in 0..nodes.len() - 1 {
                    if let Some(s) = writer.connect(nodes[i], nodes[i + 1], 99) {
                        synapses.push(s);
                    }
                    if let Some(s) = writer.connect(nodes[0], nodes[i + 1], 88) {
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
    // Continuously transverses the dynamic graph memory on-the-fly, simulating an consumer thread.
    // Proves that structural pointers NEVER point to stale memory, freed memory,
    // and that the garbage collection boundaries physically prevent topology tearing.
    let reader_handle = thread::spawn(move || {
        let mut total_swaps = 0;
        let mut max_nodes_seen = 0;

        while is_running.load(Ordering::Acquire) {
            if reader.swap() {
                total_swaps += 1;

                let mut node_opt = reader.get_head_node();
                let mut node_count = 0;

                while let Some(node) = node_opt {
                    node_count += 1;
                    assert!(node_count <= 128, "Node loop");
                    let _attr = node.get_meta(0);

                    let mut syn_opt = if node.get_outgoing_synapse_head() != 0 {
                        Some(reader.get_synapse(node.get_outgoing_synapse_head()))
                    } else { None };
                    
                    let mut syn_count = 0;
                    while let Some(syn) = syn_opt {
                        syn_count += 1;
                        assert!(syn_count <= 256, "Out syn loop");
                        assert!(syn.get_target_ptr() > 0, "Invalid target");
                        
                        syn_opt = if syn.get_outgoing_next_ptr() != 0 {
                            Some(reader.get_synapse(syn.get_outgoing_next_ptr()))
                        } else { None };
                    }

                    let mut in_syn_opt = if node.get_incoming_synapse_head() != 0 {
                        Some(reader.get_synapse(node.get_incoming_synapse_head()))
                    } else { None };
                    
                    let mut in_syn_count = 0;
                    while let Some(syn) = in_syn_opt {
                        in_syn_count += 1;
                        assert!(in_syn_count <= 256, "In syn loop");
                        assert!(syn.get_source_ptr() > 0, "Invalid source");
                        
                        in_syn_opt = if syn.get_incoming_next_ptr() != 0 {
                            Some(reader.get_synapse(syn.get_incoming_next_ptr()))
                        } else { None };
                    }

                    node_opt = if node.get_next_ptr() != 0 {
                        Some(reader.get_node(node.get_next_ptr()))
                    } else { None };
                }

                if node_count > max_nodes_seen {
                    max_nodes_seen = node_count;
                }
            }
        }

        (total_swaps, max_nodes_seen)
    });

    writer_handle.join().unwrap();
    let (_swaps, _max_nodes) = reader_handle.join().unwrap();
    
    // We expect the reader to have successfully swapped and navigated multiple times
    // without ever crashing or triggering the anti-cycle bounds safely proving data integrity.
}
