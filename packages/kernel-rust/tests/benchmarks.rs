use std::sync::Arc;
use std::sync::atomic::AtomicI32;
use std::time::Instant;
use symphonyscript_kernel::primitives::types::SAB;
use symphonyscript_kernel::primitives::hash_table::probe_hash_table::ProbeHashTable;
use symphonyscript_kernel::primitives::hash_table::hash_table_trait::HashTable;
use symphonyscript_kernel::primitives::ring_buffer::RingBuffer;
use symphonyscript_kernel::primitives::free_list::FreeList;

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

    bench("set (sequential insert)", iterations as u64, || {
        for i in 0..iterations {
            table.set(i, i * 10).unwrap();
        }
    });

    bench("get (sequential, all hits)", iterations as u64, || {
        for i in 0..iterations {
            assert!(table.get(i).is_some());
        }
    });

    bench("get (sequential, all misses)", iterations as u64, || {
        for i in iterations..(iterations * 2) {
            assert!(table.get(i).is_none());
        }
    });

    bench("set (overwrite existing)", iterations as u64, || {
        for i in 0..iterations {
            table.set(i, i * 20).unwrap();
        }
    });

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

    {
        let sab = create_sab(1_000_000);
        let ring: RingBuffer<4> = RingBuffer::new(sab, 0, 131072);

        bench("write (sequential, SLOT_SIZE=4)", iterations as u64, || {
            for i in 0..iterations {
                ring.write([i, i + 1, i + 2, i + 3]).unwrap();
            }
        });
    }

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

    {
        let sab = create_sab(1_000_000);
        let ring: RingBuffer<1> = RingBuffer::new(sab, 0, 131072);

        bench("write (sequential, SLOT_SIZE=1)", iterations as u64, || {
            for i in 0..iterations {
                ring.write([i]).unwrap();
            }
        });
    }

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

#[test]
fn benchmark_free_list() {
    println!("\n=== FreeList Benchmarks ===\n");

    let iterations = 10_000u64;

    // Bench: sequential alloc
    {
        let sab = create_sab(1_000_000);
        let fl: FreeList<4> = FreeList::new(sab, 0, 16384);

        bench("alloc (sequential, SLOT_SIZE=4)", iterations, || {
            for _ in 0..iterations {
                fl.alloc().unwrap();
            }
        });
    }

    // Bench: sequential free
    {
        let sab = create_sab(1_000_000);
        let fl: FreeList<4> = FreeList::new(sab, 0, 16384);

        let handles: Vec<_> = (0..iterations).map(|_| fl.alloc().unwrap()).collect();

        bench("free (sequential, SLOT_SIZE=4)", iterations, || {
            for h in handles {
                fl.free(h).unwrap();
            }
        });
    }

    // Bench: alloc + free interleaved
    {
        let sab = create_sab(1_000_000);
        let fl: FreeList<4> = FreeList::new(sab, 0, 16384);

        bench("alloc+free interleaved (SLOT_SIZE=4)", iterations, || {
            for _ in 0..iterations {
                let slot = fl.alloc().unwrap();
                fl.free(slot).unwrap();
            }
        });
    }

    // Bench: alloc + write + free cycle
    {
        let sab = create_sab(1_000_000);
        let fl: FreeList<4> = FreeList::new(sab, 0, 16384);

        bench("alloc+write+free cycle (SLOT_SIZE=4)", iterations, || {
            for i in 0..iterations {
                let slot = fl.alloc().unwrap();
                slot.write_all([i as i32; 4]);
                fl.free(slot).unwrap();
            }
        });
    }

    // Bench: alloc with SLOT_SIZE=1
    {
        let sab = create_sab(1_000_000);
        let fl: FreeList<1> = FreeList::new(sab, 0, 16384);

        bench("alloc (sequential, SLOT_SIZE=1)", iterations, || {
            for _ in 0..iterations {
                fl.alloc().unwrap();
            }
        });
    }

    // Bench: alloc with SLOT_SIZE=16
    {
        let sab = create_sab(4_000_000);
        let fl: FreeList<16> = FreeList::new(sab, 0, 16384);

        bench("alloc (sequential, SLOT_SIZE=16)", iterations, || {
            for _ in 0..iterations {
                fl.alloc().unwrap();
            }
        });
    }

    println!();
}

