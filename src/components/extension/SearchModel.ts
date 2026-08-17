import { NormalizedTreeNode } from './TreeModel';

export interface SearchMatchRange {
    end: number;
    start: number;
}

export interface HierarchySearchResult {
    autoExpandedPaths: string[];
    matchCount: number;
    matchingKeys: Set<string>;
    normalizedTerm: string;
    tree: NormalizedTreeNode[];
}

/** Normalize user-entered search text for matching and display decisions. */
export function normalizeHierarchySearchTerm(searchTerm: string): string {
    return searchTerm.trim().toLocaleLowerCase();
}

/** Return every non-overlapping case-insensitive match within a label. */
export function getSearchMatchRanges(label: string, searchTerm: string): SearchMatchRange[] {
    const normalizedTerm=normalizeHierarchySearchTerm(searchTerm);
    if(normalizedTerm==='') { return []; }
    const normalizedLabel=label.toLocaleLowerCase();
    const ranges: SearchMatchRange[]=[];
    let start=normalizedLabel.indexOf(normalizedTerm);
    while(start!==-1) {
        ranges.push({ start, end: start+normalizedTerm.length });
        start=normalizedLabel.indexOf(normalizedTerm, start+normalizedTerm.length);
    }
    return ranges;
}

/**
 * Filter a hierarchy to direct matches plus their ancestor context.
 *
 * The returned paths use the same slash-delimited keys as TreeMenu, allowing
 * consumers to expand only branches that lead to matching descendants.
 */
export function getHierarchySearchResult(
    nodes: readonly NormalizedTreeNode[],
    searchTerm: string
): HierarchySearchResult {
    const normalizedTerm=normalizeHierarchySearchTerm(searchTerm);
    if(normalizedTerm==='') {
        return {
            autoExpandedPaths: [],
            matchCount: 0,
            matchingKeys: new Set<string>(),
            normalizedTerm,
            tree: nodes.slice()
        };
    }

    const autoExpandedPaths: string[]=[];
    const matchingKeys=new Set<string>();

    function visit(node: NormalizedTreeNode, parentPath: string): NormalizedTreeNode|undefined {
        const path=parentPath===''?node.key:`${ parentPath }/${ node.key }`;
        const children=node.nodes.reduce<NormalizedTreeNode[]>((result, child) => {
            const matchingChild=visit(child, path);
            if(matchingChild) { result.push(matchingChild); }
            return result;
        }, []);
        const matches=node.label.toLocaleLowerCase().includes(normalizedTerm);
        if(matches) { matchingKeys.add(node.key); }
        if(!matches&&children.length===0) { return undefined; }
        if(children.length>0) { autoExpandedPaths.push(path); }
        return { ...node, nodes: children };
    }

    const tree=nodes.reduce<NormalizedTreeNode[]>((result, node) => {
        const matchingNode=visit(node, '');
        if(matchingNode) { result.push(matchingNode); }
        return result;
    }, []);
    return {
        autoExpandedPaths,
        matchCount: matchingKeys.size,
        matchingKeys,
        normalizedTerm,
        tree
    };
}
