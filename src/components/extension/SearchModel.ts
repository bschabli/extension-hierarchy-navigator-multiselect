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
    if(ranges.length>0) { return ranges; }

    const fuzzyPositions=findSubsequencePositions(normalizedLabel, normalizedTerm);
    if(fuzzyPositions.length>0) { return positionsToRanges(fuzzyPositions); }
    return findApproximateRange(normalizedLabel, normalizedTerm);
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
        const matches=getSearchMatchRanges(node.label, normalizedTerm).length>0;
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

function findSubsequencePositions(label: string, term: string): number[] {
    if(term.length<2) { return []; }
    const positions: number[]=[];
    let labelIndex=0;
    for(const character of term) {
        const matchIndex=label.indexOf(character, labelIndex);
        if(matchIndex===-1) { return []; }
        positions.push(matchIndex);
        labelIndex=matchIndex+1;
    }
    return positions;
}

function positionsToRanges(positions: readonly number[]): SearchMatchRange[] {
    return positions.reduce<SearchMatchRange[]>((ranges, position) => {
        const previous=ranges[ranges.length-1];
        if(previous&&previous.end===position) { previous.end=position+1; }
        else { ranges.push({ start: position, end: position+1 }); }
        return ranges;
    }, []);
}

function findApproximateRange(label: string, term: string): SearchMatchRange[] {
    if(term.length<4) { return []; }
    const maxDistance=Math.max(1, Math.floor(term.length*0.25));
    const candidates: Array<{ end: number, start: number, value: string }>=[];
    const wordPattern=/[\p{L}\p{N}]+/gu;
    let match=wordPattern.exec(label);
    while(match) {
        candidates.push({ start: match.index, end: match.index+match[0].length, value: match[0] });
        match=wordPattern.exec(label);
    }
    candidates.push({ start: 0, end: label.length, value: label });
    const best=candidates.reduce<{ distance: number, end: number, start: number }|undefined>(
        (result, candidate) => {
            if(Math.abs(candidate.value.length-term.length)>maxDistance) { return result; }
            const distance=getEditDistance(candidate.value, term, maxDistance);
            if(distance>maxDistance||result&&result.distance<=distance) { return result; }
            return { distance, end: candidate.end, start: candidate.start };
        },
        undefined
    );
    return best?[{ start: best.start, end: best.end }]:[];
}

function getEditDistance(left: string, right: string, limit: number): number {
    let previous=Array.from({ length: right.length+1 }, (_value, index) => index);
    for(let leftIndex=1;leftIndex<=left.length;leftIndex++) {
        const current=[leftIndex];
        let rowMinimum=current[0];
        for(let rightIndex=1;rightIndex<=right.length;rightIndex++) {
            const substitution=previous[rightIndex-1]+(
                left[leftIndex-1]===right[rightIndex-1]?0:1
            );
            const value=Math.min(previous[rightIndex]+1, current[rightIndex-1]+1, substitution);
            current.push(value);
            rowMinimum=Math.min(rowMinimum, value);
        }
        if(rowMinimum>limit) { return limit+1; }
        previous=current;
    }
    return previous[right.length];
}
