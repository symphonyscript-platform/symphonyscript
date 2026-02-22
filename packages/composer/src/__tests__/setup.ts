/**
 * Task 058: Global test setup. Clip factory uses Kernel as source of truth;
 * initSession(createTestBridge()) provides traverseNotes for build()/toOperations().
 */
import { initSession } from '../Clip';
import { createTestBridge } from '../test-bridge';

beforeEach(() => {
    initSession(createTestBridge());
});
