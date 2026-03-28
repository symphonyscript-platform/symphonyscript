Cues should return object descriptors ("Virtual DOM"), instead of deferred callbacks.
Then diffing algorithm would catch differences and only apply those mutations to kernel.
