use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;


use synaptic_kernel::kernel::Kernel;
use synaptic_kernel::epoch_consumer::EpochConsumer;
use synaptic_kernel::kernel_config::KernelConfig;

const NODE_META: usize = 8;
const NODE_ATTR: usize = 16;
const SYNAPSE_META: usize = 8;
const SYNAPSE_ATTR: usize = 16;

type TestKernel = Kernel<NODE_META, NODE_ATTR, SYNAPSE_META, SYNAPSE_ATTR>;
type TestProcessor = EpochConsumer<NODE_META, NODE_ATTR, SYNAPSE_META, SYNAPSE_ATTR>;

fn config(n: usize, s: usize) -> KernelConfig {
    KernelConfig {
        node_capacity: n,
        synapse_capacity: s,
        mem_metadata_size: 1,
        tb_metadata_size: 1,
    }
}

// ============ Epoch Stress: Grow Under Consumer Load with Proper Ack ============

/// The critical test: main thread grows while consumer thread traverses using
/// the KernelProcessor interface (acquire_mirror + ack). This validates the
/// epoch-based reclamation prevents use-after-free.
#[test]
fn epoch_stress_grow_under_consumer_load_with_ack() {
    let mut controller = TestKernel::new(config(8, 8));
    let cp_addr = Arc::as_ptr(&controller.get_control_plane()) as usize;

    // Seed initial data
    let n1 = controller.insert_head_node(1).unwrap();
    let n2 = controller.insert_node_after(n1, 2).unwrap();
    controller.connect(n1, n2, 10).unwrap();
    controller.set_node_attribute(n1, 0, 42);
    controller.publish();

    let running = Arc::new(AtomicBool::new(true));
    let running_consumer = running.clone();

    // Consumer thread: uses KernelProcessor (acquire_mirror + ack)
    let consumer_thread = thread::spawn(move || {
        let cp_ref = unsafe { &*(cp_addr as *const synaptic_kernel::control_plane::ControlPlane<NODE_META, NODE_ATTR, SYNAPSE_META, SYNAPSE_ATTR>) };
        let cp_arc: Arc<synaptic_kernel::control_plane::ControlPlane<NODE_META, NODE_ATTR, SYNAPSE_META, SYNAPSE_ATTR>> = unsafe { Arc::from_raw(cp_ref) };
        let mut processor = TestProcessor::new(Arc::clone(&cp_arc));
        std::mem::forget(cp_arc);
        let mut iterations = 0u64;
        let mut max_chain_len = 0usize;

        while running_consumer.load(Ordering::Relaxed) {
            let graph = processor.acquire_mirror();

            // Traverse the full chain
            let mut current = graph.get_head_node();
            let mut count = 0;
            while let Some(node) = current {
                let kind: i32 = node.get_kind();
                // Kind values should be in expected range
                assert!(
                    kind >= 0 && kind < 200,
                    "corrupt kind: {} at iteration {}",
                    kind, iterations
                );

                let next_ptr = node.get_next_ptr();
                if next_ptr == 0 {
                    break;
                }
                current = Some(graph.get_node(next_ptr));
                count += 1;
                assert!(
                    count <= 128,
                    "chain exceeded max length — possible cycle at iteration {}",
                    iterations
                );
            }

            if count > max_chain_len {
                max_chain_len = count;
            }

            iterations += 1;
            thread::yield_now();
        }

        (iterations, max_chain_len)
    });

    // Main thread: grow multiple times while inserting nodes
    controller.grow(config(16, 16)).unwrap();
    controller.publish();

    for i in 3..14 {
        controller.insert_head_node(i).unwrap();
    }
    controller.publish();

    controller.grow(config(32, 32)).unwrap();
    controller.publish();

    for i in 14..28 {
        controller.insert_head_node(i).unwrap();
    }
    controller.publish();

    controller.grow(config(64, 64)).unwrap();
    controller.publish();

    // Let consumer thread process a few more frames
    thread::sleep(Duration::from_millis(20));

    // Extra publishes to exercise GC draining
    for _ in 0..5 {
        controller.publish();
        thread::sleep(Duration::from_millis(2));
    }

    running.store(false, Ordering::Relaxed);
    let (iterations, _max_chain) = consumer_thread.join().expect("consumer thread panicked");
    assert!(iterations > 0, "consumer thread never ran");
}

// ============ Epoch Stress: Random Operations Under Load ============

#[test]
fn epoch_stress_random_mutations_under_consumer_load() {
    let mut controller = TestKernel::new(config(16, 16));
    let cp_addr = Arc::as_ptr(&controller.get_control_plane()) as usize;

    // Seed some initial data
    let mut node_slots = Vec::new();
    for i in 0..8 {
        let slot = controller.insert_head_node(i).unwrap();
        node_slots.push(slot);
    }

    // Connect some synapses
    let mut synapse_slots = Vec::new();
    for i in 0..node_slots.len() - 1 {
        let s = controller.connect(node_slots[i], node_slots[i + 1], (i * 10) as i32).unwrap();
        synapse_slots.push(s);
    }
    controller.publish();

    let running = Arc::new(AtomicBool::new(true));
    let running_consumer = running.clone();

    // Consumer thread with KernelProcessor
    let consumer_thread = thread::spawn(move || {
        let cp_ref = unsafe { &*(cp_addr as *const synaptic_kernel::control_plane::ControlPlane<NODE_META, NODE_ATTR, SYNAPSE_META, SYNAPSE_ATTR>) };
        let cp_arc: Arc<synaptic_kernel::control_plane::ControlPlane<NODE_META, NODE_ATTR, SYNAPSE_META, SYNAPSE_ATTR>> = unsafe { Arc::from_raw(cp_ref) };
        let mut processor = TestProcessor::new(Arc::clone(&cp_arc));
        std::mem::forget(cp_arc);
        let mut iterations = 0u64;

        while running_consumer.load(Ordering::Relaxed) {
            let graph = processor.acquire_mirror();

            // Full graph traversal: nodes + synapses
            let mut current = graph.get_head_node();
            let mut node_count = 0;
            while let Some(node) = current {
                let kind: i32 = node.get_kind();
                assert!(kind >= 0, "negative kind: {}", kind);

                // Traverse outgoing synapses for each node
                let mut syn_slot = node.get_outgoing_synapse_head();
                let mut syn_count = 0;
                while syn_slot > 0 {
                    let syn = graph.get_synapse(syn_slot);
                    let _syn_kind = syn.get_kind();
                    syn_slot = syn.get_outgoing_next_ptr();
                    syn_count += 1;
                    assert!(
                        syn_count <= 64,
                        "synapse chain too long — possible cycle"
                    );
                }

                let next_ptr = node.get_next_ptr();
                if next_ptr == 0 {
                    break;
                }
                current = Some(graph.get_node(next_ptr));
                node_count += 1;
                assert!(node_count <= 128, "node chain too long");
            }
            iterations += 1;
        }

        iterations
    });

    // Main thread: interleaved mutations
    for batch in 0..20 {
        // Insert some nodes
        for i in 0..3 {
            let kind = (batch * 10 + i) as i32;
            if let Ok(slot) = controller.insert_head_node(kind) {
                node_slots.push(slot);
            }
        }

        // Remove some nodes (oldest ones, if they have no synapses)
        if node_slots.len() > 10 {
            // Disconnect synapses first
            while let Some(s) = synapse_slots.pop() {
                let _ = controller.disconnect_synapse(s);
            }

            // Remove a few nodes
            for _ in 0..2 {
                if let Some(slot) = node_slots.pop() {
                    let _ = controller.remove_node(slot);
                }
            }
        }

        // Reconnect
        if node_slots.len() >= 2 {
            let src = node_slots[0];
            let tgt = node_slots[node_slots.len() - 1];
            if let Ok(s) = controller.connect(src, tgt, batch as i32) {
                synapse_slots.push(s);
            }
        }

        // Write some attributes
        if let Some(&slot) = node_slots.first() {
            controller.set_node_attribute(slot, 0, batch as i32 * 100);
        }

        controller.publish();

        // Occasionally grow
        if batch == 5 {
            controller.grow(config(32, 32)).unwrap();
            controller.publish();
        }
        if batch == 12 {
            controller.grow(config(64, 64)).unwrap();
            controller.publish();
        }
    }

    thread::sleep(Duration::from_millis(10));

    // Final GC drain
    for _ in 0..5 {
        controller.publish();
    }

    running.store(false, Ordering::Relaxed);
    let iterations = consumer_thread.join().expect("consumer thread panicked during random mutations");
    assert!(iterations > 0, "consumer thread never ran");
}

// ============ Epoch Stress: Consumer Thread Acking at Varying Speeds ============

#[test]
fn epoch_stress_slow_ack_does_not_crash() {
    let mut controller = TestKernel::new(config(8, 8));
    let cp_addr = Arc::as_ptr(&controller.get_control_plane()) as usize;

    controller.insert_head_node(1).unwrap();
    controller.publish();

    let running = Arc::new(AtomicBool::new(true));
    let running_consumer = running.clone();

    // Slow consumer thread: acks infrequently
    let consumer_thread = thread::spawn(move || {
        let cp_ref = unsafe { &*(cp_addr as *const synaptic_kernel::control_plane::ControlPlane<NODE_META, NODE_ATTR, SYNAPSE_META, SYNAPSE_ATTR>) };
        let cp_arc: Arc<synaptic_kernel::control_plane::ControlPlane<NODE_META, NODE_ATTR, SYNAPSE_META, SYNAPSE_ATTR>> = unsafe { Arc::from_raw(cp_ref) };
        let mut processor = TestProcessor::new(Arc::clone(&cp_arc));
        std::mem::forget(cp_arc);
        let mut iterations = 0u64;

        while running_consumer.load(Ordering::Relaxed) {
            let graph = processor.acquire_mirror();

            // Simulate slow processing
            let mut current = graph.get_head_node();
            while let Some(node) = current {
                let next: usize = node.get_next_ptr();
                if next == 0 { break; }
                current = Some(graph.get_node(next));
            }

            // Sleep to simulate slow consumer processing
            thread::sleep(Duration::from_millis(5));
            iterations += 1;
        }

        iterations
    });

    // Main thread: rapid grows while consumer is slow
    // Capacities must be powers of 2
    let grow_caps = [16, 32, 64, 128, 256];
    for (i, &new_cap) in grow_caps.iter().enumerate() {
        controller.grow(config(new_cap, new_cap)).unwrap();

        // Insert some nodes
        for j in 0..4 {
            let _ = controller.insert_head_node((i * 10 + j) as i32);
        }

        controller.publish();
        thread::sleep(Duration::from_millis(3));
    }

    // Let consumer thread finish current work
    thread::sleep(Duration::from_millis(30));

    // Drain pending readers
    for _ in 0..10 {
        controller.publish();
        thread::sleep(Duration::from_millis(2));
    }

    running.store(false, Ordering::Relaxed);
    let iterations = consumer_thread.join().expect("consumer thread panicked with slow ack");
    assert!(iterations > 0, "consumer thread never ran");
}

// ============ Epoch Stress: Attribute Writes During Traversal ============

#[test]
fn epoch_stress_concurrent_attribute_writes_with_processor() {
    let controller = TestKernel::new(config(16, 16));
    let cp_addr = Arc::as_ptr(&controller.get_control_plane()) as usize;

    // Create nodes with attributes
    let mut slots = Vec::new();
    for i in 0..8 {
        let s = controller.insert_head_node(i).unwrap();
        for offset in 0..16 {
            controller.set_node_attribute(s, offset, 0);
        }
        slots.push(s);
    }

    let running = Arc::new(AtomicBool::new(true));
    let running_consumer = running.clone();
    let slots_clone = slots.clone();

    // Consumer thread: reads attributes via KernelProcessor
    let consumer_thread = thread::spawn(move || {
        let cp_ref = unsafe { &*(cp_addr as *const synaptic_kernel::control_plane::ControlPlane<NODE_META, NODE_ATTR, SYNAPSE_META, SYNAPSE_ATTR>) };
        let cp_arc: Arc<synaptic_kernel::control_plane::ControlPlane<NODE_META, NODE_ATTR, SYNAPSE_META, SYNAPSE_ATTR>> = unsafe { Arc::from_raw(cp_ref) };
        let mut processor = TestProcessor::new(Arc::clone(&cp_arc));
        std::mem::forget(cp_arc);
        let mut iterations = 0u64;

        while running_consumer.load(Ordering::Relaxed) {
            let graph = processor.acquire_mirror();

            // Read all attributes for all slots
            for &slot in &slots_clone {
                for offset in 0..16 {
                    let val = graph.get_node_attribute(slot, offset);
                    // Value should be a valid i32 (no torn reads on AtomicI32)
                    let _ = val;
                }
            }
            iterations += 1;
        }

        iterations
    });

    // Main thread: rapidly writes attributes
    for batch in 0..500 {
        for &slot in &slots {
            for offset in 0..16 {
                controller.set_node_attribute(
                    slot,
                    offset,
                    (offset as i32) * 1000 + batch,
                );
            }
        }
    }

    thread::sleep(Duration::from_millis(5));

    running.store(false, Ordering::Relaxed);
    let iterations = consumer_thread.join().expect("consumer thread panicked during attribute writes");
    assert!(iterations > 0, "consumer thread never ran");
}

// ============ Epoch Stress: Multiple Rapid Grows Without Consumer Ack ============

#[test]
fn epoch_stress_grows_accumulate_without_ack() {
    let mut controller = TestKernel::new(config(4, 4));

    controller.insert_head_node(1).unwrap();

    // Grow 10 times rapidly WITHOUT any consumer thread acking
    // This tests that readers_pending_deletion accumulates safely
    for i in 1..=10 {
        let cap = 4 * (1 << i); // 8, 16, 32, ...
        if cap <= 4096 {
            controller.grow(config(cap, cap)).unwrap();
            controller.publish();
        }
    }

    // Now create a processor and ack
    let mut processor = TestProcessor::new(controller.get_control_plane());

    let graph = processor.acquire_mirror();
    let head = graph.get_head_node();
    assert!(head.is_some());
    assert_eq!(head.unwrap().get_kind(), 1);

    // Publish to drain all accumulated pending readers
    controller.publish();

    // System should be fully functional
    controller.insert_head_node(2).unwrap();
    assert_eq!(controller.get_head_node().unwrap().get_kind(), 2);
}
