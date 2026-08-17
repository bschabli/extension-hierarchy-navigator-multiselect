import { NormalizedTreeNode } from '../extension/TreeModel';

export interface HierarchyPreviewRow {
    depth: number;
    expanded: boolean;
    node: NormalizedTreeNode;
}

export interface HierarchyPreviewRows {
    rows: HierarchyPreviewRow[];
    truncated: boolean;
}

/**
 * Flatten the currently visible part of a preview tree.
 *
 * Search results retain matching ancestors, while ordinary browsing only
 * descends into branches the user has expanded.
 */
export function getHierarchyPreviewRows(
    nodes: readonly NormalizedTreeNode[],
    expandedKeys: ReadonlySet<string>,
    searchTerm: string,
    limit=100
): HierarchyPreviewRows {
    const rows: HierarchyPreviewRow[]=[];
    const normalizedSearch=searchTerm.trim().toLocaleLowerCase();
    const matchCache=new Map<string, boolean>();
    let truncated=false;

    function containsMatch(node: NormalizedTreeNode): boolean {
        const cached=matchCache.get(node.key);
        if(typeof cached==='boolean') { return cached; }
        const matches=node.label.toLocaleLowerCase().includes(normalizedSearch)||
            node.nodes.some(containsMatch);
        matchCache.set(node.key, matches);
        return matches;
    }

    function addNodes(currentNodes: readonly NormalizedTreeNode[], depth: number): void {
        currentNodes.forEach(node => {
            if(truncated||(normalizedSearch!==''&&!containsMatch(node))) { return; }
            if(rows.length>=limit) {
                truncated=true;
                return;
            }
            const showChildren=normalizedSearch!==''?
                node.nodes.some(containsMatch):expandedKeys.has(node.key);
            rows.push({ depth, expanded: showChildren, node });
            if(showChildren) { addNodes(node.nodes, depth+1); }
        });
    }

    addNodes(nodes, 0);
    return { rows, truncated };
}
