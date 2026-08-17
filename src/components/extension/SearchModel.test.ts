import { buildFlatTree } from './TreeModel';
import {
    getHierarchySearchResult,
    getSearchMatchRanges,
    normalizeHierarchySearchTerm
} from './SearchModel';

function assert(condition: boolean, message: string): void {
    if(!condition) { throw new Error(message); }
}

function makeTree() {
    return buildFlatTree([
        ['Furniture', 'Bookcases', 'Atlantic', 'atlantic'],
        ['Furniture', 'Bookcases', 'Bush', 'bush'],
        ['Furniture', 'Chairs', 'Hon', 'hon'],
        ['Office Supplies', 'Binders', 'Bush', 'office-bush']
    ], [0, 1, 2], 3);
}

function testAncestorContextAndExpansionPaths(): void {
    const result=getHierarchySearchResult(makeTree(), 'bush');
    assert(result.matchCount===2, 'Search should count direct label matches, not their ancestors.');
    assert(
        result.tree.map(node => node.label).join(',')==='Furniture,Office Supplies',
        'Every root containing a match should remain visible.'
    );
    assert(
        result.tree[0].nodes[0].nodes[0].label==='Bush',
        'A matching leaf should retain its complete ancestor context.'
    );
    assert(
        result.autoExpandedPaths.length===4,
        'Every ancestor branch leading to a match should be available for automatic expansion.'
    );
}

function testDirectParentMatchDoesNotExposeUnrelatedDescendants(): void {
    const result=getHierarchySearchResult(makeTree(), 'Furniture');
    assert(result.matchCount===1, 'A direct parent label should count as one match.');
    assert(result.tree.length===1&&result.tree[0].label==='Furniture', 'The matching parent should remain visible.');
    assert(result.tree[0].nodes.length===0, 'Non-matching descendants should not clutter parent search results.');
}

function testRangesAndNormalization(): void {
    const ranges=getSearchMatchRanges('Banana Band', ' AN ');
    assert(normalizeHierarchySearchTerm(' AN ')==='an', 'Search should trim whitespace and ignore case.');
    assert(
        ranges.map(range => `${ range.start }-${ range.end }`).join(',')==='1-3,3-5,8-10',
        'Highlight ranges should cover every non-overlapping match.'
    );
    assert(getSearchMatchRanges('Furniture', '   ').length===0, 'Blank search text should not create highlights.');
}

function testBlankSearchPreservesTree(): void {
    const tree=makeTree();
    const result=getHierarchySearchResult(tree, '');
    assert(result.tree.length===tree.length, 'Blank search should preserve the complete hierarchy.');
    assert(result.autoExpandedPaths.length===0&&result.matchCount===0, 'Blank search should not create search state.');
}

testAncestorContextAndExpansionPaths();
testDirectParentMatchDoesNotExposeUnrelatedDescendants();
testRangesAndNormalization();
testBlankSearchPreservesTree();
console.log('Hierarchy search model acceptance tests passed.');
