use crate::kernel_config::KernelConfig;

#[derive(Clone)]
pub struct SerializedKernel {
    pub config: KernelConfig,
    pub mem: Vec<i32>,
}
