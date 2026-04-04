use std::sync::atomic::AtomicI32;
use std::sync::Arc;

use symphonyscript_kernel::attribute_plane::reader::attribute_plane_reader::AttributePlaneReader;
use symphonyscript_kernel::attribute_plane::reader::synapse_attributes_reader::SynapseAttributesReader;
use symphonyscript_kernel::attribute_plane::writer::attribute_plane_writer::AttributePlaneWriter;
use symphonyscript_kernel::attribute_plane::writer::synapse_attributes_writer::SynapseAttributes;

use symphonyscript_kernel::constants::SYNAPSE_ATTRIBUTES_SLOT_SIZE;
use symphonyscript_kernel::primitives::types::AtomicBuffer;

fn create_mem(size: usize) -> AtomicBuffer {
    Arc::new((0..size).map(|_| AtomicI32::new(0)).collect())
}

const MEM_SIZE: usize = 4096;
const CAPACITY: usize = 16;

#[test]
fn synapse_attributes_reader_all_fields() {
    let mem = create_mem(MEM_SIZE);
    let writer =
        AttributePlaneWriter::<SYNAPSE_ATTRIBUTES_SLOT_SIZE>::new(mem.clone(), 0, CAPACITY);
    let reader = AttributePlaneReader::<SYNAPSE_ATTRIBUTES_SLOT_SIZE>::bind(mem, 0, CAPACITY);

    writer.set(
        0,
        SynapseAttributes {
            weight: 1000,
            tick_offset: -10,
            transpose: 12,
            volume_scale: 80,
            duration_scale: 50,
            tempo_scale: 120,
        },
    );

    let syn = SynapseAttributesReader(reader.get(0));

    assert_eq!(syn.weight(), 1000);
    assert_eq!(syn.tick_offset(), -10);
    assert_eq!(syn.transpose(), 12);
    assert_eq!(syn.volume_scale(), 80);
    assert_eq!(syn.duration_scale(), 50);
    assert_eq!(syn.tempo_scale(), 120);
}
