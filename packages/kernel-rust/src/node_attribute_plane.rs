use crate::node_attributes::{NodeAttributesData, NodeAttributesView};
use crate::primitives::types::SAB;

pub struct NodeAttributePlane {
    sab: SAB,
    start_index: usize,
    end_index: usize,
    capacity: usize,
}

impl NodeAttributePlane {
    pub fn new(sab: SAB, start_index: usize, capacity: usize) -> Self {
        let end_index = start_index + capacity * NodeAttributesView::SLOT_SIZE;

        assert!(end_index < sab.len(), "NodeAttributePlane out of bounds");

        NodeAttributePlane {
            sab,
            start_index,
            end_index,
            capacity,
        }
    }

    pub fn end_index(&self) -> usize {
        self.end_index
    }

    pub fn get(&self, offset: usize) -> NodeAttributesView<'_> {
        debug_assert!(offset < self.capacity, "offset out of bounds");

        NodeAttributesView {
            sab: &self.sab,
            start_index: NodeAttributesView::resolve_sab_index(self.start_index, offset),
        }
    }

    pub fn set(&self, offset: usize, data: NodeAttributesData) {
        debug_assert!(offset < self.capacity, "offset out of bounds");

        let view = NodeAttributesView {
            sab: &self.sab,
            start_index: NodeAttributesView::resolve_sab_index(self.start_index, offset),
        };
        view.set_pitch(data.pitch);
        view.set_velocity(data.velocity);
        view.set_duration(data.duration);
        view.set_volume(data.volume);
        view.set_spatial_x(data.spatial_x);
        view.set_spatial_y(data.spatial_y);
        view.set_spatial_z(data.spatial_z);
        view.set_detune(data.detune);
        view.set_tick_offset(data.tick_offset);
        view.set_flags(data.flags);
    }
}
