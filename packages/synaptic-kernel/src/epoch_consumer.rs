use crate::control_plane::ControlPlane;
use crate::epoch_mirror::EpochMirror;
use std::sync::Arc;

/// Consumer-side entry point to the epoch mirror reader.
///
/// Wraps a `ControlPlane` reference and provides `acquire_mirror()`,
/// which combines epoch mirror acquisition with triple-buffer consumption into
/// a single call.
///
/// # Threading
/// Consumer thread only.
///
/// # Usage
/// Call `acquire_mirror()` at the start of every processing cycle.
/// It:
/// 1. Acquires the current `EpochMirror` from the `ControlPlane` - while also
///    internally acknowledging the current generation before loading the pointer.
/// 2. Calls `swap()` to consume any pending updates on the default triple buffer.
/// 3. Returns the ready-to-read `EpochMirror`.
///
/// User TBs are **not** swapped by `acquire_mirror()`. To consume user TB updates,
/// call `swap_tb(id)` on the returned `EpochMirror` explicitly.
///
/// The returned reference is valid for the entire cycle - no re-acquisition needed.
///
/// # Constraints
/// - Created by passing `Arc<ControlPlane>` to `new()`.
pub struct EpochConsumer<
    const TB_COUNT: usize,
    const STORE_COUNT: usize,
    const NODE_META_STRIDE: usize,
    const NODE_ATTRIBUTES_STRIDE: usize,
    const SYNAPSE_META_STRIDE: usize,
    const SYNAPSE_ATTRIBUTES_STRIDE: usize,
> {
    control_plane: Arc<
        ControlPlane<
            TB_COUNT,
            STORE_COUNT,
            NODE_META_STRIDE,
            NODE_ATTRIBUTES_STRIDE,
            SYNAPSE_META_STRIDE,
            SYNAPSE_ATTRIBUTES_STRIDE,
        >,
    >,
}

impl<
    const TB_COUNT: usize,
    const STORE_COUNT: usize,
    const NODE_META_STRIDE: usize,
    const NODE_ATTRIBUTES_STRIDE: usize,
    const SYNAPSE_META_STRIDE: usize,
    const SYNAPSE_ATTRIBUTES_STRIDE: usize,
>
    EpochConsumer<
        TB_COUNT,
        STORE_COUNT,
        NODE_META_STRIDE,
        NODE_ATTRIBUTES_STRIDE,
        SYNAPSE_META_STRIDE,
        SYNAPSE_ATTRIBUTES_STRIDE,
    >
{
    pub fn new(
        control_plane: Arc<
            ControlPlane<
                TB_COUNT,
                STORE_COUNT,
                NODE_META_STRIDE,
                NODE_ATTRIBUTES_STRIDE,
                SYNAPSE_META_STRIDE,
                SYNAPSE_ATTRIBUTES_STRIDE,
            >,
        >,
    ) -> Self {
        EpochConsumer { control_plane }
    }

    /// Acquires the current mirror for this processing cycle.
    ///
    /// Acknowledges the current generation, loads the mirror pointer, and
    /// consumes any pending triple-buffer updates - returning ready-to-read
    /// `EpochMirror`.
    ///
    /// Takes `&mut self` to guarantee at most one live mirror reference at a time.
    /// The compiler ensures the previous reference is dropped before the next
    /// acquisition, so the generation acknowledgement always reflects
    /// the consumer's actual state.
    ///
    /// # Usage
    /// Call once at the start of each processing cycle. The returned reference
    /// is valid until the next `acquire_mirror()` call.
    pub fn acquire_mirror(
        &mut self,
    ) -> &EpochMirror<
        TB_COUNT,
        STORE_COUNT,
        NODE_META_STRIDE,
        NODE_ATTRIBUTES_STRIDE,
        SYNAPSE_META_STRIDE,
        SYNAPSE_ATTRIBUTES_STRIDE,
    > {
        let mirror = self.control_plane.acquire_mirror();

        mirror.swap();

        mirror
    }
}
