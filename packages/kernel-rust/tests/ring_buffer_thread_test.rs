use std::sync::Arc;
use std::sync::atomic::AtomicI32;
use std::thread;
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

/// SPSC: one writer thread, one reader thread.
/// Writer produces N messages, reader consumes and verifies all.
#[test]
fn spsc_basic_integrity() {
    let sab = create_sab(4096);
    let message_count = 1000;

    // Writer side
    let writer_sab = Arc::clone(&sab);
    let writer = thread::spawn(move || {
        let ring: RingBuffer<2> = RingBuffer::new(writer_sab, 0, 64);

        for i in 0..message_count {
            // Spin until write succeeds (buffer might be full)
            loop {
                if ring.write([i, i * 2]).is_ok() {
                    break;
                }
                thread::yield_now();
            }
        }
    });

    // Reader side
    let reader_sab = Arc::clone(&sab);
    let reader = thread::spawn(move || {
        let ring: RingBuffer<2> = RingBuffer::bind(reader_sab, 0, 64);
        let mut received = 0i32;

        while received < message_count {
            if let Some(data) = ring.read() {
                // Verify data integrity: no partial writes
                assert_eq!(data[0], received, "out-of-order or corrupted data[0]");
                assert_eq!(data[1], received * 2, "out-of-order or corrupted data[1]");
                received += 1;
            } else {
                thread::yield_now();
            }
        }

        received
    });

    writer.join().unwrap();
    let total_received = reader.join().unwrap();
    assert_eq!(total_received, message_count);
}

/// SPSC stress test: high volume with small buffer to maximize contention.
#[test]
fn spsc_stress_small_buffer() {
    let sab = create_sab(4096);
    let message_count: i32 = 10_000;

    let writer_sab = Arc::clone(&sab);
    let writer = thread::spawn(move || {
        let ring: RingBuffer<4> = RingBuffer::new(writer_sab, 0, 8); // tiny buffer = max contention

        for i in 0..message_count {
            loop {
                if ring.write([i, i + 1, i + 2, i + 3]).is_ok() {
                    break;
                }
                thread::yield_now();
            }
        }
    });

    let reader_sab = Arc::clone(&sab);
    let reader = thread::spawn(move || {
        let ring: RingBuffer<4> = RingBuffer::bind(reader_sab, 0, 8);
        let mut received = 0i32;

        while received < message_count {
            if let Some(data) = ring.read() {
                assert_eq!(data[0], received);
                assert_eq!(data[1], received + 1);
                assert_eq!(data[2], received + 2);
                assert_eq!(data[3], received + 3);
                received += 1;
            } else {
                thread::yield_now();
            }
        }

        received
    });

    writer.join().unwrap();
    let total = reader.join().unwrap();
    assert_eq!(total, message_count);
}

/// SPSC: verify no data tearing (partial writes visible to reader).
/// Uses large slot size to increase window for tearing.
#[test]
fn spsc_no_data_tearing() {
    let sab = create_sab(8192);
    let message_count: i32 = 5_000;

    let writer_sab = Arc::clone(&sab);
    let writer = thread::spawn(move || {
        let ring: RingBuffer<8> = RingBuffer::new(writer_sab, 0, 16);

        for i in 0..message_count {
            // Each message: all fields set to the same value.
            // If reader sees mixed values, tearing occurred.
            let msg = [i; 8];
            loop {
                if ring.write(msg).is_ok() {
                    break;
                }
                thread::yield_now();
            }
        }
    });

    let reader_sab = Arc::clone(&sab);
    let reader = thread::spawn(move || {
        let ring: RingBuffer<8> = RingBuffer::bind(reader_sab, 0, 16);
        let mut received = 0i32;

        while received < message_count {
            if let Some(data) = ring.read() {
                // All 8 fields must be the same value — no tearing
                let expected = data[0];
                for j in 1..8 {
                    assert_eq!(
                        data[j], expected,
                        "DATA TEARING: slot[{}]={} but slot[0]={} at message {}",
                        j, data[j], expected, received
                    );
                }
                assert_eq!(expected, received, "out-of-order message");
                received += 1;
            } else {
                thread::yield_now();
            }
        }

        received
    });

    writer.join().unwrap();
    let total = reader.join().unwrap();
    assert_eq!(total, message_count);
}

/// SPSC: writer produces in bursts, reader drains in bursts.
/// Tests wrap-around under bursty patterns.
#[test]
fn spsc_bursty_pattern() {
    let sab = create_sab(4096);
    let burst_size = 16;
    let burst_count = 100;
    let total_messages: i32 = burst_size * burst_count;

    let writer_sab = Arc::clone(&sab);
    let writer = thread::spawn(move || {
        let ring: RingBuffer<2> = RingBuffer::new(writer_sab, 0, 32);

        for burst in 0..burst_count {
            for i in 0..burst_size {
                let val = burst * burst_size + i;
                loop {
                    if ring.write([val, val + 1000]).is_ok() {
                        break;
                    }
                    thread::yield_now();
                }
            }
            // Pause between bursts to let reader catch up
            thread::yield_now();
        }
    });

    let reader_sab = Arc::clone(&sab);
    let reader = thread::spawn(move || {
        let ring: RingBuffer<2> = RingBuffer::bind(reader_sab, 0, 32);
        let mut received = 0i32;

        while received < total_messages {
            if let Some(data) = ring.read() {
                assert_eq!(data[0], received);
                assert_eq!(data[1], received + 1000);
                received += 1;
            } else {
                thread::yield_now();
            }
        }

        received
    });

    writer.join().unwrap();
    let total = reader.join().unwrap();
    assert_eq!(total, total_messages);
}

/// SPSC: pending count remains consistent after concurrent read/write.
#[test]
fn spsc_pending_count_consistency() {
    let sab = create_sab(4096);
    let message_count: i32 = 5_000;

    let writer_sab = Arc::clone(&sab);
    let writer = thread::spawn(move || {
        let ring: RingBuffer<2> = RingBuffer::new(writer_sab, 0, 32);

        for i in 0..message_count {
            loop {
                if ring.write([i, 0]).is_ok() {
                    break;
                }
                thread::yield_now();
            }
        }
    });

    let reader_sab = Arc::clone(&sab);
    let reader = thread::spawn(move || {
        let ring: RingBuffer<2> = RingBuffer::bind(reader_sab, 0, 32);
        let mut received = 0i32;

        while received < message_count {
            let pending = ring.pending_count();
            assert!(pending >= 0, "pending count went negative: {}", pending);
            assert!(pending <= 32, "pending count exceeded capacity: {}", pending);

            if let Some(_) = ring.read() {
                received += 1;
            } else {
                thread::yield_now();
            }
        }

        received
    });

    writer.join().unwrap();
    let total = reader.join().unwrap();
    assert_eq!(total, message_count);
}
