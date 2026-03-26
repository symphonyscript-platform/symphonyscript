use std::sync::Arc;
use std::sync::atomic::AtomicI32;
use std::time::Instant;
use symphonyscript_kernel::primitives::types::SAB;
use symphonyscript_kernel::primitives::hash_table::probe_hash_table::ProbeHashTable;
use symphonyscript_kernel::primitives::hash_table::hash_table_trait::HashTable;
use symphonyscript_kernel::primitives::ring_buffer::RingBuffer;

fn create_sab(size: usize) -> SAB {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

fn fibonacci_hash(key: i32, shift: u32) -> usize {
    let fib: u32 = 2654435769;
    ((key as u32).wrapping_mul(fib) >> shift) as usize
}

fn bench<F: FnOnce() -> R, R>(label: &str, iterations: u64, f: F) -> R {
    let start = Instant::now();
    let result = f();
    let elapsed = start.elapsed();
    let ns_per_op = elapsed.as_nanos() as f64 / iterations as f64;
    println!("  {:<40} {:>10.1} ns/op  ({:.2?} total, {} ops)", label, ns_per_op, elapsed, iterations);
    result
}

#[test]
fn benchmark_hash_table() {
    println!("\n=== ProbeHashTable Benchmarks ===\n");

    let iterations: i32 = 100_000;
    let sab = create_sab(1_000_000);
    let table = ProbeHashTable::new(sab, 0, 131072, 0.75, fibonacci_hash);

    // Bench: sequential inserts
    bench("set (sequential insert)", iterations as u64, || {
        for i in 0..iterations {
            table.set(i, i * 10).unwrap();
        }
    });

    // Bench: sequential lookups (all hits)
    bench("get (sequential, all hits)", iterations as u64, || {
        for i in 0..iterations {
            assert!(table.get(i).is_some());
        }
    });

    // Bench: lookups for nonexistent keys (all misses)
    bench("get (sequential, all misses)", iterations as u64, || {
        for i in iterations..(iterations * 2) {
            assert!(table.get(i).is_none());
        }
    });

    // Bench: overwrites
    bench("set (overwrite existing)", iterations as u64, || {
        for i in 0..iterations {
            table.set(i, i * 20).unwrap();
        }
    });

    // Bench: deletes
    bench("delete (sequential)", iterations as u64, || {
        for i in 0..iterations {
            table.delete(i);
        }
    });

    println!();
}

#[test]
fn benchmark_ring_buffer() {
    println!("\n=== RingBuffer Benchmarks ===\n");

    let iterations: i32 = 100_000;

    // Bench: write throughput
    {
        let sab = create_sab(1_000_000);
        let ring: RingBuffer<4> = RingBuffer::new(sab, 0, 131072);

        bench("write (sequential, SLOT_SIZE=4)", iterations as u64, || {
            for i in 0..iterations {
                ring.write([i, i + 1, i + 2, i + 3]).unwrap();
            }
        });
    }

    // Bench: read throughput (pre-filled)
    {
        let sab = create_sab(1_000_000);
        let ring: RingBuffer<4> = RingBuffer::new(sab, 0, 131072);

        for i in 0..iterations {
            ring.write([i, i + 1, i + 2, i + 3]).unwrap();
        }

        bench("read (sequential, SLOT_SIZE=4)", iterations as u64, || {
            for _ in 0..iterations {
                ring.read().unwrap();
            }
        });
    }

    // Bench: write/read interleaved (simulates real SPSC pattern)
    {
        let sab = create_sab(4096);
        let ring: RingBuffer<4> = RingBuffer::new(sab, 0, 64);

        bench("write+read interleaved (SLOT_SIZE=4)", iterations as u64, || {
            for i in 0..iterations {
                ring.write([i, 0, 0, 0]).unwrap();
                ring.read().unwrap();
            }
        });
    }

    // Bench: small slot size
    {
        let sab = create_sab(1_000_000);
        let ring: RingBuffer<1> = RingBuffer::new(sab, 0, 131072);

        bench("write (sequential, SLOT_SIZE=1)", iterations as u64, || {
            for i in 0..iterations {
                ring.write([i]).unwrap();
            }
        });
    }

    // Bench: large slot size
    {
        let sab = create_sab(4_000_000);
        let ring: RingBuffer<16> = RingBuffer::new(sab, 0, 131072);

        bench("write (sequential, SLOT_SIZE=16)", iterations as u64, || {
            for i in 0..iterations {
                ring.write([i; 16]).unwrap();
            }
        });
    }

    println!();
}
