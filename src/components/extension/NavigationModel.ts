import { SelectionBehavior } from '../API/SelectionBehavior';
import { NormalizedTreeNode, getNodeSelectionValues } from './TreeModel';

export const MAX_OPEN_NODE_PATHS=10000;

export interface HierarchyNavigationEntry {
    depth: number;
    node: NormalizedTreeNode;
    path: string;
}

/** Flatten the hierarchy in visual order while retaining each TreeMenu path and depth. */
export function getHierarchyNavigationEntries(
    nodes: readonly NormalizedTreeNode[]
): HierarchyNavigationEntry[] {
    function visit(
        currentNodes: readonly NormalizedTreeNode[],
        depth: number,
        parentPath: string
    ): HierarchyNavigationEntry[] {
        return currentNodes.reduce<HierarchyNavigationEntry[]>((entries, node) => {
            const path=parentPath===''?node.key:`${ parentPath }/${ node.key }`;
            entries.push({ depth, node, path });
            return entries.concat(visit(node.nodes, depth+1, path));
        }, []);
    }
    return visit(nodes, 0, '');
}

/** Return the number of visual levels in the deepest branch. */
export function getHierarchyLevelCount(nodes: readonly NormalizedTreeNode[]): number {
    return getHierarchyNavigationEntries(nodes).reduce(
        (levelCount, entry) => Math.max(levelCount, entry.depth+1),
        0
    );
}

/** Return the active node's complete breadcrumb path. */
export function getHierarchyBreadcrumbs(
    nodes: readonly NormalizedTreeNode[],
    nodeKey: string
): NormalizedTreeNode[] {
    function find(
        currentNodes: readonly NormalizedTreeNode[],
        ancestors: readonly NormalizedTreeNode[]
    ): NormalizedTreeNode[] {
        for(const node of currentNodes) {
            const breadcrumbs=ancestors.concat(node);
            if(node.key===nodeKey) { return breadcrumbs; }
            const childResult=find(node.nodes, breadcrumbs);
            if(childResult.length>0) { return childResult; }
        }
        return [];
    }
    return nodeKey===''?[]:find(nodes, []);
}

/** Keep selected nodes and their ancestor context without mutating the source tree. */
export function filterHierarchyToSelection(
    nodes: readonly NormalizedTreeNode[],
    selectedValues: ReadonlySet<string>,
    behavior=SelectionBehavior.TERMINAL
): NormalizedTreeNode[] {
    if(selectedValues.size===0) { return []; }
    return nodes.reduce<NormalizedTreeNode[]>((result, node) => {
        const children=filterHierarchyToSelection(node.nodes, selectedValues, behavior);
        const nodeSelected=getNodeSelectionValues(node, behavior).some(value => selectedValues.has(value));
        if(nodeSelected||children.length>0) { result.push({ ...node, nodes: children }); }
        return result;
    }, []);
}

/** Return the unique filter values controlled by every node at one visual level. */
export function getHierarchyLevelSelectionValues(
    nodes: readonly NormalizedTreeNode[],
    level: number,
    behavior=SelectionBehavior.TERMINAL
): string[] {
    const values=new Set<string>();
    getHierarchyNavigationEntries(nodes).forEach(entry => {
        if(entry.depth===level) {
            getNodeSelectionValues(entry.node, behavior).forEach(value => values.add(value));
        }
    });
    return Array.from(values);
}

/** Select or clear all values controlled by one visual level while preserving unrelated values. */
export function updateHierarchyLevelSelection(
    nodes: readonly NormalizedTreeNode[],
    level: number,
    selectedValues: ReadonlySet<string>,
    select: boolean,
    behavior=SelectionBehavior.TERMINAL
): Set<string> {
    const next=new Set(selectedValues);
    getHierarchyLevelSelectionValues(nodes, level, behavior).forEach(value => {
        if(select) { next.add(value); }
        else { next.delete(value); }
    });
    return next;
}

/** Expand every branch at one level, including the ancestors needed to reveal it. */
export function expandHierarchyLevel(
    nodes: readonly NormalizedTreeNode[],
    level: number,
    openPaths: readonly string[]
): string[] {
    const next=new Set(openPaths);
    getHierarchyNavigationEntries(nodes).forEach(entry => {
        if(entry.depth===level&&entry.node.nodes.length>0) {
            getAncestorPaths(entry.path, true).forEach(path => next.add(path));
        }
    });
    return Array.from(next);
}

/** Collapse every branch at one level and discard hidden descendant expansion state. */
export function collapseHierarchyLevel(
    nodes: readonly NormalizedTreeNode[],
    level: number,
    openPaths: readonly string[]
): string[] {
    const collapsedPaths=getHierarchyNavigationEntries(nodes)
        .filter(entry => entry.depth===level&&entry.node.nodes.length>0)
        .map(entry => entry.path);
    return openPaths.filter(openPath => !collapsedPaths.some(
        collapsedPath => openPath===collapsedPath||openPath.startsWith(`${ collapsedPath }/`)
    ));
}

/** Return ancestor paths for one TreeMenu path, optionally including the node itself. */
export function getAncestorPaths(path: string, includeSelf=false): string[] {
    const keys=path.split('/');
    const end=includeSelf?keys.length:Math.max(0, keys.length-1);
    const paths: string[]=[];
    for(let index=0;index<end;index++) {
        paths.push(index===0?keys[index]:`${ paths[index-1] }/${ keys[index] }`);
    }
    return paths;
}

/** Reveal an active item without collapsing branches the user already opened. */
export function revealHierarchyPath(openPaths: readonly string[], activePath: string): string[] {
    const requiredPaths=getAncestorPaths(activePath).slice(-MAX_OPEN_NODE_PATHS);
    const requiredPathSet=new Set(requiredPaths);
    const retainedLimit=MAX_OPEN_NODE_PATHS-requiredPaths.length;
    const retainedPathSet=new Set<string>();
    const retainedPaths: string[]=[];
    for(let index=openPaths.length-1;index>=0&&retainedPaths.length<retainedLimit;index--) {
        const path=openPaths[index];
        if(requiredPathSet.has(path)||retainedPathSet.has(path)) { continue; }
        retainedPathSet.add(path);
        retainedPaths.push(path);
    }
    retainedPaths.reverse();
    return retainedPaths.concat(requiredPaths);
}
