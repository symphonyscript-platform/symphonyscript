use crate::constants::{
    NOTE_ATTR_DETUNE, NOTE_ATTR_DURATION, NOTE_ATTR_FLAGS, NOTE_ATTR_PITCH, NOTE_ATTR_SPATIAL_X,
    NOTE_ATTR_SPATIAL_Y, NOTE_ATTR_SPATIAL_Z, NOTE_ATTR_TICK_OFFSET, NOTE_ATTR_VELOCITY,
    NOTE_ATTR_VOLUME, NOTE_FLAG_MUTED, NOTE_FLAG_SOLO,
};
use crate::symphony_engine::SymphonyEngine;

pub trait NoteOperations {
    fn is_note_muted(&self, note: usize) -> bool;
    fn mute_note(&self, note: usize);
    fn unmute_note(&self, note: usize);

    fn is_note_solo(&self, note: usize) -> bool;
    fn set_note_solo(&self, note: usize);
    fn unset_note_solo(&self, note: usize);

    fn get_note_pitch(&self, note: usize) -> i32;
    fn set_note_pitch(&self, note: usize, value: i32);

    fn get_note_velocity(&self, note: usize) -> i32;
    fn set_note_velocity(&self, note: usize, value: i32);

    fn get_note_duration(&self, note: usize) -> i32;
    fn set_note_duration(&self, note: usize, value: i32);

    fn get_note_volume(&self, note: usize) -> i32;
    fn set_note_volume(&self, note: usize, value: i32);

    fn get_note_spatial_x(&self, note: usize) -> i32;
    fn set_note_spatial_x(&self, note: usize, value: i32);

    fn get_note_spatial_y(&self, note: usize) -> i32;
    fn set_note_spatial_y(&self, note: usize, value: i32);

    fn get_note_spatial_z(&self, note: usize) -> i32;
    fn set_note_spatial_z(&self, note: usize, value: i32);

    fn get_note_detune(&self, note: usize) -> i32;
    fn set_note_detune(&self, note: usize, value: i32);

    fn get_note_tick_offset(&self, note: usize) -> i32;
    fn set_note_tick_offset(&self, note: usize, value: i32);
}

impl NoteOperations for SymphonyEngine {
    fn is_note_muted(&self, note: usize) -> bool {
        ((self.kernel.get_node_attribute(note, NOTE_ATTR_FLAGS) as u32) & (1 << NOTE_FLAG_MUTED))
            != 0
    }

    fn mute_note(&self, note: usize) {
        self.kernel
            .or_node_attribute(note, NOTE_ATTR_FLAGS, 1 << NOTE_FLAG_MUTED);
    }

    fn unmute_note(&self, note: usize) {
        self.kernel
            .and_node_attribute(note, NOTE_ATTR_FLAGS, !(1 << NOTE_FLAG_MUTED));
    }

    fn is_note_solo(&self, note: usize) -> bool {
        ((self.kernel.get_node_attribute(note, NOTE_ATTR_FLAGS) as u32) & (1 << NOTE_FLAG_SOLO))
            != 0
    }

    fn set_note_solo(&self, note: usize) {
        self.kernel
            .or_node_attribute(note, NOTE_ATTR_FLAGS, 1 << NOTE_FLAG_SOLO);
    }

    fn unset_note_solo(&self, note: usize) {
        self.kernel
            .and_node_attribute(note, NOTE_ATTR_FLAGS, !(1 << NOTE_FLAG_SOLO));
    }

    fn get_note_pitch(&self, note: usize) -> i32 {
        self.kernel.get_node_attribute(note, NOTE_ATTR_PITCH)
    }

    fn set_note_pitch(&self, note: usize, value: i32) {
        self.kernel.set_node_attribute(note, NOTE_ATTR_PITCH, value);
    }

    fn get_note_velocity(&self, note: usize) -> i32 {
        self.kernel.get_node_attribute(note, NOTE_ATTR_VELOCITY)
    }

    fn set_note_velocity(&self, note: usize, value: i32) {
        self.kernel
            .set_node_attribute(note, NOTE_ATTR_VELOCITY, value);
    }

    fn get_note_duration(&self, note: usize) -> i32 {
        self.kernel.get_node_attribute(note, NOTE_ATTR_DURATION)
    }

    fn set_note_duration(&self, note: usize, value: i32) {
        self.kernel
            .set_node_attribute(note, NOTE_ATTR_DURATION, value);
    }

    fn get_note_volume(&self, note: usize) -> i32 {
        self.kernel.get_node_attribute(note, NOTE_ATTR_VOLUME)
    }

    fn set_note_volume(&self, note: usize, value: i32) {
        self.kernel
            .set_node_attribute(note, NOTE_ATTR_VOLUME, value);
    }

    fn get_note_spatial_x(&self, note: usize) -> i32 {
        self.kernel.get_node_attribute(note, NOTE_ATTR_SPATIAL_X)
    }

    fn set_note_spatial_x(&self, note: usize, value: i32) {
        self.kernel
            .set_node_attribute(note, NOTE_ATTR_SPATIAL_X, value);
    }

    fn get_note_spatial_y(&self, note: usize) -> i32 {
        self.kernel.get_node_attribute(note, NOTE_ATTR_SPATIAL_Y)
    }

    fn set_note_spatial_y(&self, note: usize, value: i32) {
        self.kernel
            .set_node_attribute(note, NOTE_ATTR_SPATIAL_Y, value);
    }

    fn get_note_spatial_z(&self, note: usize) -> i32 {
        self.kernel.get_node_attribute(note, NOTE_ATTR_SPATIAL_Z)
    }

    fn set_note_spatial_z(&self, note: usize, value: i32) {
        self.kernel
            .set_node_attribute(note, NOTE_ATTR_SPATIAL_Z, value);
    }

    fn get_note_detune(&self, note: usize) -> i32 {
        self.kernel.get_node_attribute(note, NOTE_ATTR_DETUNE)
    }

    fn set_note_detune(&self, note: usize, value: i32) {
        self.kernel
            .set_node_attribute(note, NOTE_ATTR_DETUNE, value);
    }

    fn get_note_tick_offset(&self, note: usize) -> i32 {
        self.kernel.get_node_attribute(note, NOTE_ATTR_TICK_OFFSET)
    }

    fn set_note_tick_offset(&self, note: usize, value: i32) {
        self.kernel
            .set_node_attribute(note, NOTE_ATTR_TICK_OFFSET, value);
    }
}
