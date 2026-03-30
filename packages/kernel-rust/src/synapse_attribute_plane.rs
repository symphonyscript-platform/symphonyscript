use crate::primitives::types::SAB;
use crate::synapse_attributes::{SynapseAttributesData, SynapseAttributesView};

pub struct SynapseAttributePlane {
    sab: SAB,
    start_index: usize,
    end_index: usize,
    capacity: usize,
}

impl SynapseAttributePlane {
    pub fn new(sab: SAB, start_index: usize, capacity: usize) -> Self {
        let end_index = start_index + capacity * SynapseAttributesView::SLOT_SIZE;

        assert!(end_index < sab.len(), "SynapseAttributePlane out of bounds");

        SynapseAttributePlane {
            sab,
            start_index,
            end_index,
            capacity,
        }
    }

    pub fn end_index(&self) -> usize {
        self.end_index
    }

    pub fn get(&self, offset: usize) -> SynapseAttributesView<'_> {
        debug_assert!(offset < self.capacity, "offset out of bounds");

        SynapseAttributesView {
            sab: &self.sab,
            start_index: SynapseAttributesView::resolve_sab_index(self.start_index, offset),
        }
    }

    pub fn set(&self, offset: usize, data: SynapseAttributesData) {
        debug_assert!(offset < self.capacity, "offset out of bounds");

        let view = SynapseAttributesView {
            sab: &self.sab,
            start_index: SynapseAttributesView::resolve_sab_index(self.start_index, offset),
        };
        view.set_weight(data.weight);
        view.set_tick_offset(data.tick_offset);
        view.set_transpose(data.transpose);
        view.set_volume_scale(data.volume_scale);
    }
}
