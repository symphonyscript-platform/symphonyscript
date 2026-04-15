1. In the current kernel, what happens if you call publish() after removing a node but no consumer has ever called
   acquire_graph()? Does the slot get freed? Why or why not?

No, the slot is not freed.

The path is remove_node → NodeChainWriter::remove → SlotAllocator::defer_free → StagingBufferWriter::push. The entry is
stamped with the current writer_generation, which starts at 1.

When publish() runs, SlotAllocator::publish() calls self.staging_buffer.drain(), which creates an iterator that reads
reader_ack_generation — still 0, because nobody has acked. The iterator's gate condition:

staging_buffer_writer.rs
Lines 55-60
fn next(&mut self) -> Option<Self::Item> {
match self.buffer.peek() {
Some([data, generation]) => {
if (generation as usize).wrapping_sub(self.ack_generation) > 0 {
return None;
}
(1).wrapping_sub(0) = 1 > 0 — gate fails. Entry is not yielded. The drain produces nothing. The slot stays in the
staging buffer, bitmap stays set, free list never receives it back.

After the drain, staging_buffer.publish() bumps writer_generation to 2. Doesn't help — the ack side is what's missing.

Why by design: The initial differential is deliberate. From the doc comment:

staging_buffer_writer.rs
Lines 35-36
/// - `writer_generation` starts at 1, `reader_ack_generation` starts at 0.
/// This initial differential prevents premature draining of pre-publish entries.
The ack can only advance through StagingBufferReader::ack(), which is called inside SynapticGraphReader::swap():

synaptic_graph_reader.rs
Lines 140-145
pub fn swap(&self) -> bool {
let swapped = self.tb_reader.swap();
self.ack_node_generation();
self.ack_synapse_generation();
swapped
}
And swap() is only called by GraphConsumer::acquire_graph(). No consumer, no ack, no drain, no free. The slot is
logically dead but physically retained — it can't be reallocated, and it won't leak memory on drop since the staging
buffer ring and bitmap are value types inside the kernel's owned AtomicBuffer.

The full reclamation cycle requires: remove → publish → consumer acquires (acks) → next publish drains. Two producer
publishes with a consumer ack between them.
