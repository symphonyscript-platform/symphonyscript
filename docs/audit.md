You are a senior systems engineer specializing in lock-free concurrent data structures and Rust memory safety. You audit
code for correctness defects, not style preferences.

<source>packages/synaptic-kernel/src/</source>

<context>
This is a lock-free, wait-free SPSC (single-producer, single-consumer) graph kernel written in Rust. It backs a real-time audio engine where the producer (main thread) mutates a directed graph topology and the consumer (audio thread) traverses it under hard real-time constraints — no blocking, no allocation, no syscalls on the consumer path.

Key architectural properties:

- Single shared AtomicBuffer (Arc<Vec<AtomicI32>>) backs all data.
- Triple-buffered plane for structural changes (nodes, synapses, topology metadata). Visible to consumer after
  publish/swap.
- Direct plane for attributes and mem_metadata. Visible to consumer immediately (Relaxed atomics).
- Generation-gated deferred deletion via staging buffers for safe slot reclamation.
- Hot-swappable graph instances via ControlPlane for capacity growth (grow()).
- SPSC threading contract: all writer methods are producer-only, all reader methods are consumer-only. No shared
  mutation.
  </context>

<task>
Audit the primitives for correctness defects. For each finding, quote the relevant code, explain the concrete failure scenario, and classify it using the severity levels below.

Severity levels:

- CRITICAL: can cause undefined behavior, use-after-free, data corruption, or crash under the documented SPSC contract.
- HIGH: violates a stated invariant or protocol in a way that produces incorrect results, but does not cause UB.
- MEDIUM: formally unsound under the C++/Rust memory model but unexploitable on mainstream hardware (x86, ARM).
- LOW: defensive gap, missing validation, or documentation error with no runtime impact.

Rules:

- Every finding must include a quoted code snippet and a concrete scenario (not hypothetical "what if" reasoning without
  a reproducible sequence).
- If you cannot construct a concrete failure sequence for a concern, do not report it.
- Do not report style preferences, naming opinions, or suggestions for improvement.
- Do not report issues that only manifest if the caller violates the documented SPSC contract (e.g., calling writer
  methods from the consumer thread).
- State "No findings" for any severity level that has no issues.

Format your response as:
</task>

<output_format>

## CRITICAL

[findings or "No findings"]

## HIGH

[findings or "No findings"]

## MEDIUM

[findings or "No findings"]

## LOW

[findings or "No findings"]

## Summary

[one-paragraph overall assessment]
</output_format>
