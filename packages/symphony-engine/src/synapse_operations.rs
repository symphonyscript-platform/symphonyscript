use crate::attributes::synapse_attributes::SynapseAttributes;
use crate::constants::{
    SYNAPSE_ATTR_DURATION_SCALE, SYNAPSE_ATTR_TEMPO_SCALE, SYNAPSE_ATTR_TICK_OFFSET,
    SYNAPSE_ATTR_TRANSPOSITION, SYNAPSE_ATTR_VOLUME_SCALE, SYNAPSE_ATTR_WEIGHT,
};
use crate::symphony_engine::SymphonyEngine;
use synaptic_kernel::errors::kernel_error::KernelError;
use synaptic_kernel::errors::slot_allocator_error::SlotAllocatorError;
use synaptic_kernel::primitives::into_array::IntoArray;

pub trait SynapseOperations {
    fn get_synapse_kind(&self, synapse: usize) -> i32;
    fn get_synapse_source(&self, synapse: usize) -> usize;
    fn get_synapse_target(&self, synapse: usize) -> usize;
    fn get_synapse_outgoing_next(&self, synapse: usize) -> usize;
    fn get_synapse_outgoing_prev(&self, synapse: usize) -> usize;
    fn get_synapse_incoming_next(&self, synapse: usize) -> usize;
    fn get_synapse_incoming_prev(&self, synapse: usize) -> usize;

    fn get_synapse_weight(&self, synapse: usize) -> i32;
    fn set_synapse_weight(&self, synapse: usize, value: i32);

    fn get_synapse_tick_offset(&self, synapse: usize) -> i32;
    fn set_synapse_tick_offset(&self, synapse: usize, value: i32);

    fn get_synapse_transposition(&self, synapse: usize) -> i32;
    fn set_synapse_transposition(&self, synapse: usize, value: i32);

    fn get_synapse_volume_scale(&self, synapse: usize) -> i32;
    fn set_synapse_volume_scale(&self, synapse: usize, value: i32);

    fn get_synapse_duration_scale(&self, synapse: usize) -> i32;
    fn set_synapse_duration_scale(&self, synapse: usize, value: i32);

    fn get_synapse_tempo_scale(&self, synapse: usize) -> i32;
    fn set_synapse_tempo_scale(&self, synapse: usize, value: i32);

    fn set_synapse_attributes(&self, synapse: usize, data: SynapseAttributes);

    fn connect(&self, source: usize, target: usize, kind: i32) -> Result<usize, KernelError>;
    fn disconnect(&self, source: usize, target: usize) -> Result<(), SlotAllocatorError>;
    fn disconnect_synapse(&self, synapse: usize) -> Result<(), SlotAllocatorError>;
}

impl SynapseOperations for SymphonyEngine {
    #[inline]
    fn get_synapse_kind(&self, synapse: usize) -> i32 {
        self.kernel.get_synapse(synapse).get_kind()
    }

    #[inline]
    fn get_synapse_source(&self, synapse: usize) -> usize {
        self.kernel.get_synapse(synapse).get_source_ptr()
    }

    #[inline]
    fn get_synapse_target(&self, synapse: usize) -> usize {
        self.kernel.get_synapse(synapse).get_target_ptr()
    }

    #[inline]
    fn get_synapse_outgoing_next(&self, synapse: usize) -> usize {
        self.kernel.get_synapse(synapse).get_outgoing_next_ptr()
    }

    #[inline]
    fn get_synapse_outgoing_prev(&self, synapse: usize) -> usize {
        self.kernel.get_synapse(synapse).get_outgoing_prev_ptr()
    }

    #[inline]
    fn get_synapse_incoming_next(&self, synapse: usize) -> usize {
        self.kernel.get_synapse(synapse).get_incoming_next_ptr()
    }

    #[inline]
    fn get_synapse_incoming_prev(&self, synapse: usize) -> usize {
        self.kernel.get_synapse(synapse).get_incoming_prev_ptr()
    }

    #[inline]
    fn get_synapse_weight(&self, synapse: usize) -> i32 {
        self.kernel
            .get_synapse(synapse)
            .attr_read(SYNAPSE_ATTR_WEIGHT)
    }

    #[inline]
    fn set_synapse_weight(&self, synapse: usize, value: i32) {
        self.kernel
            .get_synapse(synapse)
            .attr_write(SYNAPSE_ATTR_WEIGHT, value);
    }

    #[inline]
    fn get_synapse_tick_offset(&self, synapse: usize) -> i32 {
        self.kernel
            .get_synapse(synapse)
            .attr_read(SYNAPSE_ATTR_TICK_OFFSET)
    }

    #[inline]
    fn set_synapse_tick_offset(&self, synapse: usize, value: i32) {
        self.kernel
            .get_synapse(synapse)
            .attr_write(SYNAPSE_ATTR_TICK_OFFSET, value);
    }

    #[inline]
    fn get_synapse_transposition(&self, synapse: usize) -> i32 {
        self.kernel
            .get_synapse(synapse)
            .attr_read(SYNAPSE_ATTR_TRANSPOSITION)
    }

    #[inline]
    fn set_synapse_transposition(&self, synapse: usize, value: i32) {
        self.kernel
            .get_synapse(synapse)
            .attr_write(SYNAPSE_ATTR_TRANSPOSITION, value);
    }

    #[inline]
    fn get_synapse_volume_scale(&self, synapse: usize) -> i32 {
        self.kernel
            .get_synapse(synapse)
            .attr_read(SYNAPSE_ATTR_VOLUME_SCALE)
    }

    #[inline]
    fn set_synapse_volume_scale(&self, synapse: usize, value: i32) {
        self.kernel
            .get_synapse(synapse)
            .attr_write(SYNAPSE_ATTR_VOLUME_SCALE, value);
    }

    #[inline]
    fn get_synapse_duration_scale(&self, synapse: usize) -> i32 {
        self.kernel
            .get_synapse(synapse)
            .attr_read(SYNAPSE_ATTR_DURATION_SCALE)
    }

    #[inline]
    fn set_synapse_duration_scale(&self, synapse: usize, value: i32) {
        self.kernel
            .get_synapse(synapse)
            .attr_write(SYNAPSE_ATTR_DURATION_SCALE, value);
    }

    #[inline]
    fn get_synapse_tempo_scale(&self, synapse: usize) -> i32 {
        self.kernel
            .get_synapse(synapse)
            .attr_read(SYNAPSE_ATTR_TEMPO_SCALE)
    }

    #[inline]
    fn set_synapse_tempo_scale(&self, synapse: usize, value: i32) {
        self.kernel
            .get_synapse(synapse)
            .attr_write(SYNAPSE_ATTR_TEMPO_SCALE, value);
    }

    #[inline]
    fn set_synapse_attributes(&self, synapse: usize, data: SynapseAttributes) {
        self.kernel
            .get_synapse(synapse)
            .attr_write_all(&data.to_array())
    }

    fn connect(&self, source: usize, target: usize, kind: i32) -> Result<usize, KernelError> {
        self.kernel.connect(source, target, kind)
    }

    fn disconnect(&self, source: usize, target: usize) -> Result<(), SlotAllocatorError> {
        self.kernel.disconnect(source, target)
    }

    fn disconnect_synapse(&self, synapse: usize) -> Result<(), SlotAllocatorError> {
        self.kernel.disconnect_synapse(synapse)
    }
}
