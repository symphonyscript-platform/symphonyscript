use synaptic_kernel::control_plane::ControlPlane;
use synaptic_kernel::kernel::Kernel;
use synaptic_kernel::graph_consumer::GraphConsumer;
use synaptic_kernel::synaptic_graph_config::SynapticGraphConfig;

const NODE_META: usize = 8;
const NODE_ATTR: usize = 16;
const SYNAPSE_META: usize = 8;
const SYNAPSE_ATTR: usize = 16;

type TestKernel = Kernel<NODE_META, NODE_ATTR, SYNAPSE_META, SYNAPSE_ATTR>;
type TestProcessor = GraphConsumer<NODE_META, NODE_ATTR, SYNAPSE_META, SYNAPSE_ATTR>;

fn config(capacity: usize) -> SynapticGraphConfig {
    SynapticGraphConfig {
        node_capacity: capacity,
        synapse_capacity: capacity,
        mem_metadata_size: 1,
        tb_metadata_size: 1,
    }
}

fn setup(capacity: usize) -> (TestKernel, TestProcessor) {
    let controller = Kernel::new(config(capacity));
    let addr = controller.get_controller_plane_address();
    let processor = TestProcessor::bind(addr);
    (controller, processor)
}

// ============ Construction / Magic Validation ============

#[test]
fn processor_new_with_valid_address_succeeds() {
    let controller = Kernel::<NODE_META, NODE_ATTR, SYNAPSE_META, SYNAPSE_ATTR>::new(config(8));
    let addr = controller.get_controller_plane_address();
    let _processor = TestProcessor::bind(addr);
}

#[test]
#[should_panic(expected = "invalid control_plane_address")]
fn processor_new_with_invalid_address_panics() {
    // Allocate zeroed memory — signature will be 0, not CONTROLLER_MAGIC
    let fake_mem = vec![0u8; 64];
    let addr = fake_mem.as_ptr() as usize;
    let _processor = TestProcessor::bind(addr);
}

// ============ acquire_graph + ack lifecycle ============

#[test]
fn acquire_graph_returns_generation_zero_initially() {
    let (mut controller, mut processor) = setup(8);

    controller.insert_head(1).unwrap();
    controller.publish();

    let (_graph, wgen) = processor.acquire_graph();
    assert_eq!(wgen, 0, "initial writer_generation should be 0");
}

#[test]
fn acquire_graph_swaps_and_returns_reader() {
    let (mut controller, mut processor) = setup(8);

    controller.insert_head(42).unwrap();
    controller.publish();

    let (graph, _wgen) = processor.acquire_graph();
    let head = graph.get_head_node();
    assert!(head.is_some());
    assert_eq!(head.unwrap().get_kind(), 42);
}

#[test]
fn ack_stores_generation_on_control_plane() {
    let (controller, mut processor) = setup(8);

    let (_graph, wgen) = processor.acquire_graph();
    processor.ack(wgen);

    // Verify via control plane
    let cp_addr = controller.get_controller_plane_address();
    let cp_ptr = cp_addr as *const ControlPlane<NODE_META, NODE_ATTR, SYNAPSE_META, SYNAPSE_ATTR>;
    let ack_gen = unsafe { (*cp_ptr).get_reader_ack_generation() };
    assert_eq!(ack_gen, wgen);
}

#[test]
fn process_calls_acquire_and_ack_automatically() {
    let (mut controller, mut processor) = setup(8);

    controller.insert_head(1).unwrap();
    controller.publish();

    processor.process();

    // After process(), ack should reflect current writer_generation
    let cp_addr = controller.get_controller_plane_address();
    let cp_ptr = cp_addr as *const ControlPlane<NODE_META, NODE_ATTR, SYNAPSE_META, SYNAPSE_ATTR>;
    let ack_gen = unsafe { (*cp_ptr).get_reader_ack_generation() };
    assert_eq!(ack_gen, 0, "initial generation should be acked");
}

// ============ Generation increments on grow ============

#[test]
fn grow_increments_writer_generation() {
    let (mut controller, mut processor) = setup(8);

    // Before grow: generation = 0
    let (_g1, wgen1) = processor.acquire_graph();
    assert_eq!(wgen1, 0);
    processor.ack(wgen1);

    // Grow: increments generation
    controller.grow(config(16)).unwrap();

    // After grow: generation = 1
    let (_g2, wgen2) = processor.acquire_graph();
    assert_eq!(wgen2, 1);
    processor.ack(wgen2);
}

#[test]
fn multiple_grows_increment_generation_monotonically() {
    let (mut controller, mut processor) = setup(4);

    let grow_caps = [8, 16, 32, 64, 128];
    for (i, &cap) in grow_caps.iter().enumerate() {
        let expected = i as i32;
        let (_graph, wgen) = processor.acquire_graph();
        assert_eq!(wgen, expected);
        processor.ack(wgen);

        controller.grow(config(cap)).unwrap();
    }
}

// ============ Epoch-based reclamation gating ============

#[test]
fn publish_does_not_drain_pending_readers_without_ack() {
    let (mut controller, _processor) = setup(4);

    controller.insert_head(1).unwrap();

    // Grow creates a pending reader at generation 1
    controller.grow(config(8)).unwrap();

    // Publish WITHOUT audio thread acking — pending reader should NOT be dropped
    controller.publish();
    controller.publish();
    controller.publish();

    // Verify the kernel is still functional
    let head = controller.get_head_node().unwrap();
    assert_eq!(head.get_kind(), 1);
}

#[test]
fn publish_drains_pending_readers_after_ack() {
    let (mut controller, mut processor) = setup(4);

    controller.insert_head(1).unwrap();

    // Grow: creates pending reader at generation 1
    controller.grow(config(8)).unwrap();

    // Audio thread acks generation 1
    let (_graph, wgen) = processor.acquire_graph();
    processor.ack(wgen);

    // Publish should now drain the pending reader
    controller.publish();

    // System should be functional and clean
    assert_eq!(controller.node_capacity(), 8);
    assert_eq!(controller.get_head_node().unwrap().get_kind(), 1);
}

#[test]
fn multiple_grow_then_ack_drains_all_up_to_generation() {
    let (mut controller, mut processor) = setup(4);

    controller.insert_head(1).unwrap();

    // 3 grows = 3 pending readers at generations 1, 2, 3
    controller.grow(config(8)).unwrap();
    controller.grow(config(16)).unwrap();
    controller.grow(config(32)).unwrap();

    // Ack generation 3 (current)
    let (_graph, wgen) = processor.acquire_graph();
    assert_eq!(wgen, 3);
    processor.ack(wgen);

    // Publish should drain all 3 pending readers (all <= acked generation 3)
    controller.publish();

    // Verify system is clean and functional
    assert_eq!(controller.node_capacity(), 32);
    controller.insert_head(2).unwrap();
    assert_eq!(controller.get_head_node().unwrap().get_kind(), 2);
}

#[test]
fn partial_ack_only_drains_older_readers() {
    let (mut controller, mut processor) = setup(4);

    controller.insert_head(1).unwrap();

    // Grow 1: generation 1
    controller.grow(config(8)).unwrap();

    // Ack generation 1
    let (_graph, wgen1) = processor.acquire_graph();
    assert_eq!(wgen1, 1);
    processor.ack(wgen1);

    // Grow 2: generation 2
    controller.grow(config(16)).unwrap();

    // Grow 3: generation 3
    controller.grow(config(32)).unwrap();

    // Publish: should drain generation 1 (acked), but NOT 2 or 3
    controller.publish();

    // System should still be functional — generation 2 and 3 readers are retained safely
    assert_eq!(controller.node_capacity(), 32);

    // Now ack generation 3 and publish to drain the rest
    let (_graph2, wgen3) = processor.acquire_graph();
    assert_eq!(wgen3, 3);
    processor.ack(wgen3);
    controller.publish();
}

// ============ Custom traversal pattern ============

#[test]
fn custom_traversal_acquire_traverse_ack() {
    let (mut controller, mut processor) = setup(16);

    let n1 = controller.insert_head(10).unwrap();
    let n2 = controller.insert_after(n1, 20).unwrap();
    let _n3 = controller.insert_after(n2, 30).unwrap();
    controller.connect(n1, n2, 99).unwrap();
    controller.set_node_attribute(n1, 0, 1000);
    controller.publish();

    // Custom traversal
    let (graph, wgen) = processor.acquire_graph();

    // Traverse nodes
    let mut kinds = vec![];
    let mut current = graph.get_head_node();
    while let Some(node) = current {
        kinds.push(node.get_kind());
        let next = node.get_next_ptr();
        if next == 0 { break; }
        current = Some(graph.get_node(next));
    }
    assert_eq!(kinds, vec![10, 20, 30]);

    // Read attributes
    assert_eq!(graph.get_node_attribute(n1, 0), 1000);

    // Read synapse
    let src_node = graph.get_node(n1);
    let syn_slot = src_node.get_outgoing_synapse_head();
    assert!(syn_slot > 0);
    let syn = graph.get_synapse(syn_slot);
    assert_eq!(syn.get_kind(), 99);

    // Ack after traversal complete
    processor.ack(wgen);
}

// ============ Graph pointer updates after grow ============

#[test]
fn processor_sees_new_graph_after_grow() {
    let (mut controller, mut processor) = setup(4);

    controller.insert_head(1).unwrap();
    controller.publish();

    // First traversal on old graph
    let (graph1, wgen1) = processor.acquire_graph();
    assert_eq!(graph1.get_head_node().unwrap().get_kind(), 1);
    processor.ack(wgen1);

    // Grow and add more data
    controller.grow(config(16)).unwrap();
    controller.insert_head(2).unwrap();
    controller.publish();

    // Second traversal should see new graph with new data
    let (graph2, wgen2) = processor.acquire_graph();
    assert_eq!(wgen2, 1, "generation should be 1 after grow");
    assert_eq!(graph2.get_head_node().unwrap().get_kind(), 2);
    processor.ack(wgen2);
}
