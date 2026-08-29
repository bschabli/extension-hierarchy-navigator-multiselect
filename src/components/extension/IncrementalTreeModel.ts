import {
    HierarchyCell,
    NormalizedTreeNode,
    normalizeHierarchyValue
} from './TreeModel';

export type HierarchyDatasetSnapshot=Map<string, number>;

export interface TreeReconciliationResult {
    changedNodeCount: number;
    nodeCount: number;
    reusedNodeCount: number;
    tree: NormalizedTreeNode[];
}

/** Capture the relevant row values as an exact, order-independent multiset. */
export function createHierarchyDatasetSnapshot(
    rows: readonly HierarchyCell[][],
    columnIndexes: readonly number[]
): HierarchyDatasetSnapshot {
    const snapshot: HierarchyDatasetSnapshot=new Map<string, number>();
    rows.forEach(row => {
        const signature=JSON.stringify(columnIndexes.map(index => normalizeHierarchyValue(row[index])??null));
        snapshot.set(signature, (snapshot.get(signature)||0)+1);
    });
    return snapshot;
}

/** Return whether two hierarchy snapshots contain exactly the same relevant rows. */
export function hierarchyDatasetSnapshotsEqual(
    left: HierarchyDatasetSnapshot|undefined,
    right: HierarchyDatasetSnapshot
): boolean {
    if(!left||left.size!==right.size) { return false; }
    for(const [signature, count] of left) {
        if(right.get(signature)!==count) { return false; }
    }
    return true;
}

/** Reuse unchanged normalized nodes so refreshes update only changed branches. */
export function reconcileNormalizedTree(
    previousTree: NormalizedTreeNode[],
    nextTree: readonly NormalizedTreeNode[]
): TreeReconciliationResult {
    const previousByKey=new Map<string, NormalizedTreeNode>();
    addPreviousNodes(previousTree, previousByKey);
    let nodeCount=0;
    let reusedNodeCount=0;

    const reconcileNodes=(nodes: readonly NormalizedTreeNode[]): NormalizedTreeNode[] => nodes.map(node => {
        nodeCount+=1;
        const reconciledChildren=reconcileNodes(node.nodes);
        const previous=previousByKey.get(node.key);
        if(previous&&nodeMetadataEqual(previous, node)&&arraysReferenceEqual(previous.nodes, reconciledChildren)) {
            reusedNodeCount+=1;
            return previous;
        }
        return arraysReferenceEqual(node.nodes, reconciledChildren)?node:{ ...node, nodes: reconciledChildren };
    });
    const reconciledRoots=reconcileNodes(nextTree);
    const tree=arraysReferenceEqual(previousTree, reconciledRoots)?previousTree:reconciledRoots;
    return {
        changedNodeCount: nodeCount-reusedNodeCount,
        nodeCount,
        reusedNodeCount,
        tree
    };
}

function addPreviousNodes(
    nodes: readonly NormalizedTreeNode[],
    result: Map<string, NormalizedTreeNode>
): void {
    nodes.forEach(node => {
        result.set(node.key, node);
        addPreviousNodes(node.nodes, result);
    });
}

function nodeMetadataEqual(left: NormalizedTreeNode, right: NormalizedTreeNode): boolean {
    return left.hierarchyValue===right.hierarchyValue&&left.label===right.label&&
        stringArraysEqual(left.directFilterValues, right.directFilterValues)&&
        stringArraysEqual(left.terminalFilterValues, right.terminalFilterValues)&&
        stringArraysEqual(left.subtreeFilterValues, right.subtreeFilterValues)&&
        numberArraysEqual(left.sourceLevels, right.sourceLevels)&&
        optionalStringArraysEqual(left.sourcePathValues, right.sourcePathValues);
}

function arraysReferenceEqual<T>(left: readonly T[], right: readonly T[]): boolean {
    return left.length===right.length&&left.every((value, index) => value===right[index]);
}

function stringArraysEqual(left: readonly string[], right: readonly string[]): boolean {
    return left.length===right.length&&left.every((value, index) => value===right[index]);
}

function numberArraysEqual(left: readonly number[], right: readonly number[]): boolean {
    return left.length===right.length&&left.every((value, index) => value===right[index]);
}

function optionalStringArraysEqual(
    left: readonly (string|undefined)[],
    right: readonly (string|undefined)[]
): boolean {
    return left.length===right.length&&left.every((value, index) => value===right[index]);
}
