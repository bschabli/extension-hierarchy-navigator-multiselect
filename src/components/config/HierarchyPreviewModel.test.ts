import { buildFlatTree } from '../extension/TreeModel';
import { getHierarchyPreviewRows } from './HierarchyPreviewModel';

function assert(condition: boolean, message: string): void {
    if(!condition) { throw new Error(message); }
}

function makeTree() {
    return buildFlatTree([
        ['Furniture', 'Bookcases', 'Atlantic', 'atlantic'],
        ['Furniture', 'Bookcases', 'Bush', 'bush'],
        ['Furniture', 'Chairs', 'Hon', 'hon'],
        ['Office Supplies', 'Binders', 'Avery', 'avery']
    ], [0, 1, 2], 3);
}

function testExpandedRows(): void {
    const tree=makeTree();
    const root=tree[0];
    const rows=getHierarchyPreviewRows(tree, new Set([root.key]), '').rows;
    assert(
        rows.map(row => row.node.label).join(',')==='Furniture,Bookcases,Chairs,Office Supplies',
        'Only explicitly expanded branches should expose their children.'
    );
    assert(rows[1].depth===1, 'Expanded children should be indented one level.');
}

function testSearchRetainsAncestors(): void {
    const result=getHierarchyPreviewRows(makeTree(), new Set<string>(), 'bush');
    const rows=result.rows;
    assert(result.matchCount===1, 'Search should report direct matches separately from ancestor context.');
    assert(
        rows.map(row => row.node.label).join(',')==='Furniture,Bookcases,Bush',
        'Search should reveal a match with its ancestor path even when branches are closed.'
    );
    assert(rows[2].depth===2, 'Search result depth should remain meaningful.');
    assert(rows[0].expanded&&rows[1].expanded&&!rows[2].expanded, 'Only matching ancestor branches should appear open.');
}

function testSearchIsCaseInsensitive(): void {
    const rows=getHierarchyPreviewRows(makeTree(), new Set<string>(), 'OFFICE').rows;
    assert(rows.length===1&&rows[0].node.label==='Office Supplies', 'Search should ignore case.');
    assert(!rows[0].expanded, 'A matching parent without matching descendants should stay visually closed.');
}

function testSearchCanKeepMatchingPathsCollapsed(): void {
    const tree=makeTree();
    const collapsed=getHierarchyPreviewRows(tree, new Set<string>(), 'bush', 100, false);
    assert(
        collapsed.rows.map(row => row.node.label).join(',')==='Furniture',
        'Manual search expansion should begin with the matching ancestor root.'
    );
    assert(!collapsed.rows[0].expanded, 'Manual search expansion should respect the current closed state.');

    const root=tree[0];
    const rootExpanded=getHierarchyPreviewRows(tree, new Set([root.key]), 'bush', 100, false);
    assert(
        rootExpanded.rows.map(row => row.node.label).join(',')==='Furniture,Bookcases',
        'Opening a matching ancestor should reveal only the next matching context level.'
    );
}

function testRowLimit(): void {
    const tree=makeTree();
    const result=getHierarchyPreviewRows(tree, new Set([tree[0].key]), '', 2);
    assert(result.rows.length===2, 'Preview should stop at its visible row limit.');
    assert(result.truncated, 'Preview should report when more visible rows are available.');
}

testExpandedRows();
testSearchRetainsAncestors();
testSearchIsCaseInsensitive();
testSearchCanKeepMatchingPathsCollapsed();
testRowLimit();
console.log('HierarchyPreviewModel acceptance tests passed.');
