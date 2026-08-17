import { NormalizedTreeNode } from '../extension/TreeModel';
import { getHierarchySearchResult } from '../extension/SearchModel';

export interface HierarchyPreviewRow {
    depth: number;
    expanded: boolean;
    node: NormalizedTreeNode;
}

export interface HierarchyPreviewRows {
    matchCount: number;
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
    limit=100,
    autoExpandMatches=true
): HierarchyPreviewRows {
    const rows: HierarchyPreviewRow[]=[];
    const searchResult=getHierarchySearchResult(nodes, searchTerm);
    const searchActive=searchResult.normalizedTerm!=='';
    const visibleTree=searchActive?searchResult.tree:nodes;
    let truncated=false;

    function addNodes(currentNodes: readonly NormalizedTreeNode[], depth: number): void {
        currentNodes.forEach(node => {
            if(truncated) { return; }
            if(rows.length>=limit) {
                truncated=true;
                return;
            }
            const showChildren=searchActive&&autoExpandMatches?
                node.nodes.length>0:expandedKeys.has(node.key);
            rows.push({ depth, expanded: showChildren, node });
            if(showChildren) { addNodes(node.nodes, depth+1); }
        });
    }

    addNodes(visibleTree, 0);
    return { matchCount: searchResult.matchCount, rows, truncated };
}
