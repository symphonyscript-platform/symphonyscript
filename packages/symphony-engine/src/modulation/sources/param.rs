use crate::constants::MOD_SOURCE_SIZE;
use synaptic_kernel::primitives::into_array::IntoArray;

pub struct ParamSource {
    pub initial_value: i32, // 0-1000 (unipolar) or -1000-1000 (bipolar)
    pub curve_type: i32,
    pub curve_param: i32,
    pub smooth_type: i32,
    pub smooth_param_a: i32,
    pub smooth_param_b: i32,
    pub mem_smooth_factor_lut_offset: i32,
}

impl IntoArray<MOD_SOURCE_SIZE> for ParamSource {
    fn to_array(&self) -> [i32; MOD_SOURCE_SIZE] {
        let mut data = [0; MOD_SOURCE_SIZE];

        data[0] = self.initial_value;
        data[1] = self.initial_value;
        data[2] = self.initial_value;
        data[3] = self.curve_type;
        data[4] = self.curve_param;
        data[5] = self.smooth_type;
        data[6] = self.smooth_param_a;
        data[7] = self.smooth_param_b;
        data[8] = self.mem_smooth_factor_lut_offset;

        data
    }
}
