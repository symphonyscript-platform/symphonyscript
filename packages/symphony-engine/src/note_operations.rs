use crate::constants::{
    NOTE_ATTR_DETUNE, NOTE_ATTR_DURATION, NOTE_ATTR_FLAGS, NOTE_ATTR_PITCH, NOTE_ATTR_SPATIAL_X,
    NOTE_ATTR_SPATIAL_Y, NOTE_ATTR_SPATIAL_Z, NOTE_ATTR_TICK_OFFSET, NOTE_ATTR_VELOCITY,
    NOTE_ATTR_VOLUME, NOTE_FLAG_MUTED, NOTE_FLAG_SOLO,
};
use crate::symphony_engine::SymphonyEngine;

pub trait NoteOperations {
    fn is_note_muted(&self, node: usize) -> bool;
    fn mute_note(&self, node: usize);
    fn unmute_note(&self, node: usize);

    fn is_note_solo(&self, node: usize) -> bool;
    fn set_note_solo(&self, node: usize);
    fn unset_note_solo(&self, node: usize);

    fn get_note_pitch(&self, node: usize) -> i32;
    fn set_note_pitch(&self, node: usize, value: i32);

    fn get_note_velocity(&self, node: usize) -> i32;
    fn set_note_velocity(&self, node: usize, value: i32);

    fn get_note_duration(&self, node: usize) -> i32;
    fn set_note_duration(&self, node: usize, value: i32);

    fn get_note_volume(&self, node: usize) -> i32;
    fn set_note_volume(&self, node: usize, value: i32);

    fn get_note_spatial_x(&self, node: usize) -> i32;
    fn set_note_spatial_x(&self, node: usize, value: i32);

    fn get_note_spatial_y(&self, node: usize) -> i32;
    fn set_note_spatial_y(&self, node: usize, value: i32);

    fn get_note_spatial_z(&self, node: usize) -> i32;
    fn set_note_spatial_z(&self, node: usize, value: i32);

    fn get_note_detune(&self, node: usize) -> i32;
    fn set_note_detune(&self, node: usize, value: i32);

    fn get_note_tick_offset(&self, node: usize) -> i32;
    fn set_note_tick_offset(&self, node: usize, value: i32);
}

impl NoteOperations for SymphonyEngine {
    fn is_note_muted(&self, node: usize) -> bool {
        ((self.kernel.get_node(node).attr_read(NOTE_ATTR_FLAGS) as u32) & (1 << NOTE_FLAG_MUTED))
            != 0
    }

    fn mute_note(&self, node: usize) {
        self.kernel
            .get_node(node)
            .attr_or(NOTE_ATTR_FLAGS, 1 << NOTE_FLAG_MUTED);
    }

    fn unmute_note(&self, node: usize) {
        self.kernel
            .get_node(node)
            .attr_and(NOTE_ATTR_FLAGS, !(1 << NOTE_FLAG_MUTED));
    }

    fn is_note_solo(&self, node: usize) -> bool {
        ((self.kernel.get_node(node).attr_read(NOTE_ATTR_FLAGS) as u32) & (1 << NOTE_FLAG_SOLO))
            != 0
    }

    #[inline]
    fn set_note_solo(&self, node: usize) {
        self.kernel
            .get_node(node)
            .attr_or(NOTE_ATTR_FLAGS, 1 << NOTE_FLAG_SOLO);
    }

    fn unset_note_solo(&self, node: usize) {
        self.kernel
            .get_node(node)
            .attr_and(NOTE_ATTR_FLAGS, !(1 << NOTE_FLAG_SOLO));
    }

    #[inline]
    fn get_note_pitch(&self, node: usize) -> i32 {
        self.kernel.get_node(node).attr_read(NOTE_ATTR_PITCH)
    }

    #[inline]
    fn set_note_pitch(&self, node: usize, value: i32) {
        self.kernel
            .get_node(node)
            .attr_write(NOTE_ATTR_PITCH, value);
    }

    #[inline]
    fn get_note_velocity(&self, node: usize) -> i32 {
        self.kernel.get_node(node).attr_read(NOTE_ATTR_VELOCITY)
    }

    #[inline]
    fn set_note_velocity(&self, node: usize, value: i32) {
        self.kernel
            .get_node(node)
            .attr_write(NOTE_ATTR_VELOCITY, value);
    }

    #[inline]
    fn get_note_duration(&self, node: usize) -> i32 {
        self.kernel.get_node(node).attr_read(NOTE_ATTR_DURATION)
    }

    #[inline]
    fn set_note_duration(&self, node: usize, value: i32) {
        self.kernel
            .get_node(node)
            .attr_write(NOTE_ATTR_DURATION, value);
    }

    #[inline]
    fn get_note_volume(&self, node: usize) -> i32 {
        self.kernel.get_node(node).attr_read(NOTE_ATTR_VOLUME)
    }

    #[inline]
    fn set_note_volume(&self, node: usize, value: i32) {
        self.kernel
            .get_node(node)
            .attr_write(NOTE_ATTR_VOLUME, value);
    }

    #[inline]
    fn get_note_spatial_x(&self, node: usize) -> i32 {
        self.kernel.get_node(node).attr_read(NOTE_ATTR_SPATIAL_X)
    }

    #[inline]
    fn set_note_spatial_x(&self, node: usize, value: i32) {
        self.kernel
            .get_node(node)
            .attr_write(NOTE_ATTR_SPATIAL_X, value);
    }

    #[inline]
    fn get_note_spatial_y(&self, node: usize) -> i32 {
        self.kernel.get_node(node).attr_read(NOTE_ATTR_SPATIAL_Y)
    }

    #[inline]
    fn set_note_spatial_y(&self, node: usize, value: i32) {
        self.kernel
            .get_node(node)
            .attr_write(NOTE_ATTR_SPATIAL_Y, value);
    }

    #[inline]
    fn get_note_spatial_z(&self, node: usize) -> i32 {
        self.kernel.get_node(node).attr_read(NOTE_ATTR_SPATIAL_Z)
    }

    #[inline]
    fn set_note_spatial_z(&self, node: usize, value: i32) {
        self.kernel
            .get_node(node)
            .attr_write(NOTE_ATTR_SPATIAL_Z, value);
    }

    #[inline]
    fn get_note_detune(&self, node: usize) -> i32 {
        self.kernel.get_node(node).attr_read(NOTE_ATTR_DETUNE)
    }

    #[inline]
    fn set_note_detune(&self, node: usize, value: i32) {
        self.kernel
            .get_node(node)
            .attr_write(NOTE_ATTR_DETUNE, value);
    }

    #[inline]
    fn get_note_tick_offset(&self, node: usize) -> i32 {
        self.kernel.get_node(node).attr_read(NOTE_ATTR_TICK_OFFSET)
    }

    #[inline]
    fn set_note_tick_offset(&self, node: usize, value: i32) {
        self.kernel
            .get_node(node)
            .attr_write(NOTE_ATTR_TICK_OFFSET, value);
    }
}
