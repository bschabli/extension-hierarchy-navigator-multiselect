import { buildFlatTree } from './TreeModel';
import {
    createHierarchyDatasetSnapshot,
    hierarchyDatasetSnapshotsEqual,
    reconcileNormalizedTree
} from './IncrementalTreeModel';

function assert(condition: boolean, message: string): void {
    if(!condition) { throw new Error(message); }
}

const firstRows=[
    ['Furniture', 'Chairs', 'CHAIR-1'],
    ['Furniture', 'Tables', 'TABLE-1'],
    ['Technology', 'Phones', 'PHONE-1']
];
const reorderedRows=[firstRows[2], firstRows[0], firstRows[1]];
const firstSnapshot=createHierarchyDatasetSnapshot(firstRows, [0, 1, 2]);
assert(
    hierarchyDatasetSnapshotsEqual(firstSnapshot, createHierarchyDatasetSnapshot(reorderedRows, [0, 1, 2])),
    'Row order changes should not trigger a hierarchy rebuild.'
);
assert(
    !hierarchyDatasetSnapshotsEqual(firstSnapshot, createHierarchyDatasetSnapshot([
        firstRows[0],
        ['Furniture', 'Desks', 'TABLE-1'],
        firstRows[2]
    ], [0, 1, 2])),
    'Relevant value changes should invalidate the hierarchy snapshot.'
);

const firstTree=buildFlatTree(firstRows, [0, 1], 2);
const nextTree=buildFlatTree([
    firstRows[0],
    ['Furniture', 'Desks', 'TABLE-1'],
    firstRows[2]
], [0, 1], 2);
const reconciled=reconcileNormalizedTree(firstTree, nextTree);
assert(reconciled.reusedNodeCount>0, 'Unchanged branches should retain their node objects.');
assert(
    reconciled.tree.find(node => node.label==='Technology')===firstTree.find(node => node.label==='Technology'),
    'A completely unchanged root branch should be structurally reused.'
);
assert(reconciled.changedNodeCount>0, 'Changed branches should receive new node objects.');
assert(
    reconcileNormalizedTree(firstTree, buildFlatTree(firstRows, [0, 1], 2)).tree===firstTree,
    'A normalized tree with no changes should preserve the root array identity.'
);

console.log('Incremental hierarchy model tests passed.');
