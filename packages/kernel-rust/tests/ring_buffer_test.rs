use std::sync::Arc;
use std::sync::atomic::AtomicI32;
use symphonyscript_kernel::primitives::types::SAB;
use symphonyscript_kernel::primitives::ring_buffer::ring_buffer::RingBuffer;

/// Creates a SAB with the given number of AtomicI32 slots.
fn create_sab(size: usize) -> SAB {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

#[test]
fn read_empty_buffer_returns_none() {
    let sab = create_sab(1024);
    let ring: RingBuffer<4> = RingBuffer::new(sab, 0, 8);

    assert_eq!(ring.read(), None);
}

#[test]
fn write_and_read_single_entry() {
    let sab = create_sab(1024);
    let ring: RingBuffer<4> = RingBuffer::new(sab, 0, 8);

    let data = [1, 2, 3, 4];
    assert!(ring.write(data).is_ok());

    let result = ring.read();
    assert_eq!(result, Some([1, 2, 3, 4]));
}

#[test]
fn fifo_ordering() {
    let sab = create_sab(4096);
    let ring: RingBuffer<2> = RingBuffer::new(sab, 0, 8);

    ring.write([10, 20]).unwrap();
    ring.write([30, 40]).unwrap();
    ring.write([50, 60]).unwrap();

    assert_eq!(ring.read(), Some([10, 20]));
    assert_eq!(ring.read(), Some([30, 40]));
    assert_eq!(ring.read(), Some([50, 60]));
    assert_eq!(ring.read(), None);
}

#[test]
fn pending_count_tracks_entries() {
    let sab = create_sab(1024);
    let ring: RingBuffer<2> = RingBuffer::new(sab, 0, 8);

    assert_eq!(ring.pending_count(), 0);

    ring.write([1, 2]).unwrap();
    assert_eq!(ring.pending_count(), 1);

    ring.write([3, 4]).unwrap();
    assert_eq!(ring.pending_count(), 2);

    ring.read();
    assert_eq!(ring.pending_count(), 1);

    ring.read();
    assert_eq!(ring.pending_count(), 0);
}

#[test]
fn write_full_buffer_returns_error() {
    let sab = create_sab(4096);
    let ring: RingBuffer<2> = RingBuffer::new(sab, 0, 4);

    ring.write([1, 2]).unwrap();
    ring.write([3, 4]).unwrap();
    ring.write([5, 6]).unwrap();
    ring.write([7, 8]).unwrap();

    let result = ring.write([9, 10]);
    assert!(result.is_err());
}

#[test]
fn wrap_around_read_write() {
    let sab = create_sab(4096);
    let ring: RingBuffer<2> = RingBuffer::new(sab, 0, 4);

    // Fill and drain to advance read/write pointers
    for round in 0..3 {
        for i in 0..4 {
            let val = (round * 10 + i) as i32;
            ring.write([val, val + 100]).unwrap();
        }
        for i in 0..4 {
            let val = (round * 10 + i) as i32;
            assert_eq!(ring.read(), Some([val, val + 100]));
        }
    }

    // Buffer should be empty after full drain
    assert_eq!(ring.read(), None);
    assert_eq!(ring.pending_count(), 0);
}

#[test]
fn interleaved_read_write() {
    let sab = create_sab(4096);
    let ring: RingBuffer<3> = RingBuffer::new(sab, 0, 4);

    ring.write([1, 2, 3]).unwrap();
    ring.write([4, 5, 6]).unwrap();

    assert_eq!(ring.read(), Some([1, 2, 3]));

    ring.write([7, 8, 9]).unwrap();

    assert_eq!(ring.read(), Some([4, 5, 6]));
    assert_eq!(ring.read(), Some([7, 8, 9]));
    assert_eq!(ring.read(), None);
}

#[test]
fn end_index_is_correct() {
    let sab = create_sab(4096);
    let ring: RingBuffer<4> = RingBuffer::new(sab, 0, 8);

    // end_index = start(0) + header(3) + capacity(8) * SLOT_SIZE(4) = 35
    assert_eq!(ring.end_index(), 35);
}

#[test]
fn works_with_nonzero_start_index() {
    let sab = create_sab(4096);
    let start = 200;
    let ring: RingBuffer<2> = RingBuffer::new(sab, start, 4);

    ring.write([42, 84]).unwrap();
    assert_eq!(ring.read(), Some([42, 84]));
    assert_eq!(ring.pending_count(), 0);
}

#[test]
fn single_slot_size() {
    let sab = create_sab(1024);
    let ring: RingBuffer<1> = RingBuffer::new(sab, 0, 4);

    ring.write([99]).unwrap();
    assert_eq!(ring.read(), Some([99]));
}
