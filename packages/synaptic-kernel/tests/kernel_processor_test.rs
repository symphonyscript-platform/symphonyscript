use synaptic_kernel::kernel::Kernel;
use synaptic_kernel::epoch_consumer::EpochConsumer;
use synaptic_kernel::kernel_config::KernelConfig;

const NODE_META: usize = 8;
const NODE_ATTR: usize = 16;
const SYNAPSE_META: usize = 8;
const SYNAPSE_ATTR: usize = 16;

type TestKernel = Kernel<NODE_META, NODE_ATTR, SYNAPSE_META, SYNAPSE_ATTR>;
type TestConsumer = EpochConsumer<NODE_META, NODE_ATTR, SYNAPSE_META, SYNAPSE_ATTR>;

fn config(capacity: usize) -> KernelConfig {
    KernelConfig {
        node_capacity: capacity,
        synapse_capacity: capacity,
        mem_metadata_size: 1,
        tb_metadata_size: 1,
    }
}

fn setup(capacity: usize) -> TestKernel {
    Kernel::new(config(capacity))
}

fn get_consumer(controller: &TestKernel) -> TestConsumer {
    TestConsumer::new(controller.get_control_plane())
}

// ============ Construction / Magic Validation ============





// ============ acquire_mirror basics ============

#[test]
fn acquire_mirror_returns_reader() {
    let mut controller = setup(8);
    let mut consumer = get_consumer(&controller);

    controller.insert_head_node(42).unwrap();
    controller.publish();

    let graph = consumer.acquire_mirror();
    let head = graph.get_head_node();
    assert!(head.is_some());
    assert_eq!(head.unwrap().get_kind(), 42);
}

#[test]
fn acquire_mirror_sees_published_mutations() {
    let mut controller = setup(8);
    let mut consumer = get_consumer(&controller);

    controller.insert_head_node(1).unwrap();
    controller.publish();

    let graph = consumer.acquire_mirror();
    assert_eq!(graph.get_head_node().unwrap().get_kind(), 1);

    // Second mutation
    controller.insert_head_node(2).unwrap();
    controller.publish();

    let graph = consumer.acquire_mirror();
    assert_eq!(graph.get_head_node().unwrap().get_kind(), 2);
}

#[test]
fn acquire_mirror_does_not_see_unpublished_mutations() {
    let mut controller = setup(8);
    let mut consumer = get_consumer(&controller);

    controller.insert_head_node(1).unwrap();
    controller.publish();

    // Insert but don't publish
    controller.insert_head_node(2).unwrap();

    let graph = consumer.acquire_mirror();
    // Should still see the old head — unpublished mutation not visible
    assert_eq!(graph.get_head_node().unwrap().get_kind(), 1);
}

// ============ Automatic ack enables epoch reclamation ============

#[test]
fn acquire_mirror_acks_previous_generation_enabling_drain() {
    let mut controller = setup(4);
    let mut consumer = get_consumer(&controller);

    controller.insert_head_node(1).unwrap();

    // Grow creates a pending reader at generation 1
    controller.grow(config(8)).unwrap();

    // First acquire — acks previous (gen 0), which allows draining gen-0 readers
    let _graph = consumer.acquire_mirror();

    // Second acquire — acks gen 1, allowing gen-1 reader to drain
    let _graph = consumer.acquire_mirror();

    // Publish should now drain pending readers
    controller.publish();

    // System should be functional and clean
    assert_eq!(controller.node_capacity(), 8);
    assert_eq!(controller.get_head_node().unwrap().get_kind(), 1);
}

#[test]
fn multiple_grow_then_acquire_drains_all() {
    let mut controller = setup(4);
    let mut consumer = get_consumer(&controller);

    controller.insert_head_node(1).unwrap();

    // 3 grows = 3 pending readers
    controller.grow(config(8)).unwrap();
    controller.grow(config(16)).unwrap();
    controller.grow(config(32)).unwrap();

    // Acquire acks the previous generation each time
    let _graph = consumer.acquire_mirror();
    let _graph = consumer.acquire_mirror();

    // Publish should drain pending readers up to acked generation
    controller.publish();

    // Verify system is clean and functional
    assert_eq!(controller.node_capacity(), 32);
    controller.insert_head_node(2).unwrap();
    assert_eq!(controller.get_head_node().unwrap().get_kind(), 2);
}

#[test]
fn publish_does_not_drain_without_acquire() {
    let mut controller = setup(4);
    let  _consumer = get_consumer(&controller);

    controller.insert_head_node(1).unwrap();

    // Grow creates a pending reader
    controller.grow(config(8)).unwrap();

    // Publish WITHOUT any acquire — pending reader should NOT be dropped
    controller.publish();
    controller.publish();
    controller.publish();

    // Verify the kernel is still functional
    let head = controller.get_head_node().unwrap();
    assert_eq!(head.get_kind(), 1);
}

// ============ Full traversal pattern ============

#[test]
fn full_traversal_nodes_and_synapses() {
    let mut controller = setup(16);
    let mut consumer = get_consumer(&controller);

    let n1 = controller.insert_head_node(10).unwrap();
    let n2 = controller.insert_node_after(n1, 20).unwrap();
    let _n3 = controller.insert_node_after(n2, 30).unwrap();
    controller.connect(n1, n2, 99).unwrap();
    controller.get_node(n1).attr_write(0, 1000);
    controller.publish();

    let graph = consumer.acquire_mirror();

    // Traverse nodes
    let mut kinds = vec![];
    let mut current = graph.get_head_node();
    while let Some(node) = current {
        kinds.push(node.get_kind() as i32);
        let next: usize = node.get_next_ptr();
        if next == 0 { break; }
        current = Some(graph.get_node(next));
    }
    assert_eq!(kinds, vec![10, 20, 30]);

    // Read attributes
    assert_eq!(graph.get_node(n1).attr_read(0), 1000);

    // Read synapse
    let src_node = graph.get_node(n1);
    let syn_slot = src_node.get_outgoing_synapse_head();
    assert!(syn_slot > 0);
    let syn = graph.get_synapse(syn_slot);
    assert_eq!(syn.get_kind(), 99);
}

// ============ Graph pointer updates after grow ============

#[test]
fn consumer_sees_new_graph_after_grow() {
    let mut controller = setup(4);
    let mut consumer = get_consumer(&controller);

    controller.insert_head_node(1).unwrap();
    controller.publish();

    // First traversal on old graph
    let graph = consumer.acquire_mirror();
    assert_eq!(graph.get_head_node().unwrap().get_kind(), 1);

    // Grow and add more data
    controller.grow(config(16)).unwrap();
    controller.insert_head_node(2).unwrap();
    controller.publish();

    // Second traversal should see new graph with new data
    let graph = consumer.acquire_mirror();
    assert_eq!(graph.get_head_node().unwrap().get_kind(), 2);
}
