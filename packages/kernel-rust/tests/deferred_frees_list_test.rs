use std::sync::atomic::AtomicI32;
use std::sync::Arc;
use symphonyscript_kernel::primitives::staging_buffer::StagingBuffer;

fn create_list(max_slots: usize) -> (StagingBuffer, Arc<Vec<AtomicI32>>) {
    let size = StagingBuffer::calculate_size_on_sab(max_slots);
    let sab: Vec<AtomicI32> = (0..size).map(|_| AtomicI32::new(0)).collect();
    let sab_arc = Arc::new(sab);
    (
        StagingBuffer::new(Arc::clone(&sab_arc), 0, max_slots),
        sab_arc,
    )
}

#[test]
fn push_and_drain_toggles() {
    let (list, _sab) = create_list(16);

    list.push(10);
    list.push(20);

    // Initial drain toggles the active list and returns the old (empty) list
    let mut empty_iter = list.drain();
    assert!(empty_iter.next().is_none());

    // Pushing now goes to the new active list
    list.push(30);

    // Draining toggles again, and returns the previous list (holding 10 and 20)
    let mut iter2 = list.drain();
    assert_eq!(iter2.next(), Some(10));
    assert_eq!(iter2.next(), Some(20));
    assert!(iter2.next().is_none());

    // Draining a third time without pushing gives the 30
    let mut iter3 = list.drain();
    assert_eq!(iter3.next(), Some(30));
    assert!(iter3.next().is_none());
}

#[test]
fn drain_clears_previous_length() {
    let (list, _sab) = create_list(16);

    list.push(5);
    list.drain(); // toggled

    list.drain(); // toggled and swept the '5'

    // Now if we drain again, it should be empty
    let mut iter = list.drain();
    assert!(iter.next().is_none());
}

#[test]
fn copy_from_preserves_state_and_resizes() {
    let (small, _sab_small) = create_list(16);
    small.push(5);
    small.push(10);
    small.drain(); // toggles, 5 and 10 go to backbuffer
    small.push(15);

    let (large, _sab_large) = create_list(32);
    large.copy_from(&small);

    // Drain large - toggles so it reads backbuffer (5 & 10)
    let mut prev_iter = large.drain();
    assert_eq!(prev_iter.next(), Some(5));
    assert_eq!(prev_iter.next(), Some(10));
    assert!(prev_iter.next().is_none());

    // Drain large again - toggles so it reads the other buffer (15)
    let mut cur_iter = large.drain();
    assert_eq!(cur_iter.next(), Some(15));
    assert!(cur_iter.next().is_none());
}

#[test]
#[should_panic]
fn copy_from_panics_if_source_larger() {
    let (small, _sab_small) = create_list(16);
    let (large, _sab_large) = create_list(32);
    small.copy_from(&large);
}
