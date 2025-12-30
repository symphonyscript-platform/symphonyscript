import { SynapticNode } from '../core/SynapticNode';
import { SiliconBridge } from '@symphonyscript/kernel';

// Mocks
class MockBridge {
    connect = jest.fn();
}

class ConcreteNode extends SynapticNode {
    constructor(bridge: any) {
        super(bridge);
    }

    // Helper to simulate valid state
    setIds(entry: number, exit: number) {
        this.entryId = entry;
        this.exitId = exit;
    }
}

describe('SynapticNode', () => {
    let bridge: any;
    let nodeA: ConcreteNode;
    let nodeB: ConcreteNode;

    beforeEach(() => {
        bridge = new MockBridge();
        nodeA = new ConcreteNode(bridge);
        nodeB = new ConcreteNode(bridge);
    });

    test('should throw if linking without exit ID', () => {
        expect(() => nodeA.linkTo(nodeB)).toThrow('source node has no exit ID');
    });

    test('should throw if linking to target without entry ID', () => {
        nodeA.setIds(1, 2);
        expect(() => nodeA.linkTo(nodeB)).toThrow('Node has no entry ID');
    });

    test('should call bridge.connect when IDs are valid', () => {
        nodeA.setIds(10, 20); // Exit is 20
        nodeB.setIds(30, 40); // Entry is 30

        nodeA.linkTo(nodeB, 500, 10);

        expect(bridge.connect).toHaveBeenCalledWith(20, 30, 500, 10);
    });

    test('connect alias works', () => {
        nodeA.setIds(10, 20);
        nodeB.setIds(30, 40);

        nodeA.connect(nodeB);
        expect(bridge.connect).toHaveBeenCalledWith(20, 30, undefined, undefined);
    });
});
