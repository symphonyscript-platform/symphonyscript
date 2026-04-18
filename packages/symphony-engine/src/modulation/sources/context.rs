use crate::constants::MOD_SOURCE_SIZE;
use synaptic_kernel::primitives::into_array::IntoArray;

pub struct ContextSource {
    pub mem_hash_lut_index: i32,
    pub curve_type: i32,
    pub curve_param: i32,
    pub smooth_type: i32,
    pub mem_smooth_factor_lut_offset: i32,
}

impl IntoArray<MOD_SOURCE_SIZE> for ContextSource {
    fn to_array(&self) -> [i32; MOD_SOURCE_SIZE] {
        let mut data = [0; MOD_SOURCE_SIZE];

        data[0] = self.mem_hash_lut_index;
        data[3] = self.curve_type;
        data[4] = self.curve_param;
        data[5] = self.smooth_type;
        data[6] = self.mem_smooth_factor_lut_offset;

        data
    }
}
