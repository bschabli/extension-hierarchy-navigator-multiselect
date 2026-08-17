import {
    buildFlatTree,
    buildRecursiveTree,
    getSelectionState,
    isMissingHierarchyValue,
    toggleOpenNode,
    toggleNodeSelection
} from './TreeModel';

function assert(condition: boolean, message: string): void {
    if(!condition) { throw new Error(message); }
}

function cell(value: unknown, formattedValue?: unknown): { value: unknown, formattedValue: unknown } {
    return { value, formattedValue: typeof formattedValue==='undefined'? value:formattedValue };
}

class TableauGetterCell {
    private readonly rawValue: unknown;

    private readonly displayValue: unknown;

    constructor(value: unknown, formattedValue?: unknown) {
        this.rawValue=value;
        this.displayValue=typeof formattedValue==='undefined'? value:formattedValue;
    }

    get value(): unknown { return this.rawValue; }

    get nativeValue(): unknown { return this.rawValue; }

    get formattedValue(): unknown { return this.displayValue; }
}

function testFlatVariableDepthAndNulls(): void {
    const tree=buildFlatTree([
        [cell('A'), cell('B'), cell('C'), cell('A|B|C')],
        [cell('A'), cell('D'), cell(null, 'Null'), cell('A|D')],
        [cell('E'), cell(null, 'Null'), cell('  '), cell('E')],
        [cell(null, 'Null'), cell(undefined, 'Null'), cell(''), cell('ignored')]
    ], [0, 1, 2], 3);
    assert(tree.length===2, 'Flat tree should contain A and E roots only.');
    assert(tree[0].label==='A'&&tree[0].nodes.length===2, 'A should contain B and D.');
    assert(tree[0].nodes[0].nodes[0].label==='C', 'C should be below B.');
    assert(tree[1].label==='E'&&tree[1].nodes.length===0, 'E should be a shallow leaf.');
}

function testFlatInternalGapAndUniquePaths(): void {
    const tree=buildFlatTree([
        ['A', null, 'Administration', 'a-admin'],
        ['B', '', 'Administration', 'b-admin']
    ], [0, 1, 2], 3);
    assert(tree[0].nodes[0].label==='Administration', 'Internal null gap should be skipped.');
    assert(tree[0].nodes[0].key!==tree[1].nodes[0].key, 'Identical labels under different parents need unique IDs.');
}

function testEndpointParentAndSelection(): void {
    const tree=buildFlatTree([
        ['A', 'B', null, 'row-b'],
        ['A', 'B', 'C', 'row-c'],
        ['A', 'B', 'D', 'row-d'],
        ['X', 'Y', null, 'row-y']
    ], [0, 1, 2], 3);
    const parent=tree[0].nodes[0];
    assert(parent.leafFilterValues.join(',')==='row-b,row-c,row-d', 'Endpoint parent must retain every terminal row value.');
    let selected=toggleNodeSelection(parent, new Set<string>(['row-y']));
    assert(selected.size===4&&selected.has('row-y'), 'Parent selection must preserve unrelated values.');
    selected.delete('row-c');
    assert(getSelectionState(parent, selected)==='some', 'A partially selected parent must be indeterminate.');
    selected=toggleNodeSelection(parent, selected);
    assert(getSelectionState(parent, selected)==='all', 'Toggling an indeterminate parent should select all descendants.');
    selected=toggleNodeSelection(parent, selected);
    assert(selected.size===1&&selected.has('row-y'), 'Parent deselection must only remove its subtree.');
}

function testRecursiveSelection(): void {
    const tree=buildRecursiveTree([
        [cell(null, 'Null'), 'A', 'Category A'],
        ['A', 'A1', 'Group A1'],
        ['A', 'A2', 'Group A2'],
        ['A1', 'A11', 'Leaf A11']
    ], 0, 1, 2);
    assert(tree.length===1&&tree[0].nodes.length===2, 'Recursive adapter should construct both branches.');
    assert(tree[0].leafFilterValues.join(',')==='A11,A2', 'Recursive parents select leaves at variable depths.');
    const selected=toggleNodeSelection(tree[0], new Set<string>());
    assert(getSelectionState(tree[0], selected)==='all', 'Recursive parent should become fully selected.');
}

function testTableauGetterCellsAndPartialSelection(): void {
    const tree=buildFlatTree([
        [
            new TableauGetterCell('Furniture'),
            new TableauGetterCell('Bookcases'),
            new TableauGetterCell('Atlantic'),
            new TableauGetterCell('atlantic-id')
        ],
        [
            new TableauGetterCell('Furniture'),
            new TableauGetterCell('Bookcases'),
            new TableauGetterCell('Bush'),
            new TableauGetterCell('bush-id')
        ]
    ], [0, 1, 2], 3);
    const root=tree[0];
    assert(root.label==='Furniture', 'Tableau getter-backed values should use their formatted label.');
    assert(root.nodes[0].label==='Bookcases', 'Nested getter-backed labels should remain readable.');
    assert(root.leafFilterValues.join(',')==='atlantic-id,bush-id', 'Getter-backed filter values must remain distinct.');

    const selected=toggleNodeSelection(root.nodes[0].nodes[0], new Set<string>());
    assert(getSelectionState(root, selected)==='some', 'Selecting one child should make its ancestors indeterminate.');
}

function testControlledOpenNodeToggle(): void {
    let openNodes=toggleOpenNode(['root/other'], 'root/category');
    assert(
        openNodes.join(',')==='root/other,root/category',
        'Opening a node should preserve other expanded branches and add the requested path once.'
    );
    openNodes=toggleOpenNode(openNodes, 'root/category');
    assert(openNodes.join(',')==='root/other', 'Closing a node should remove only the requested path.');
}

function testMissingValueRules(): void {
    assert(isMissingHierarchyValue(null), 'null should be missing.');
    assert(isMissingHierarchyValue(undefined), 'undefined should be missing.');
    assert(isMissingHierarchyValue('  '), 'Whitespace should be missing.');
    assert(isMissingHierarchyValue({ value: '%null%', formattedValue: 'Null' }), 'Tableau special null should be missing.');
    assert(
        isMissingHierarchyValue({ value: '%null%', nativeValue: null, formattedValue: 'Null' }),
        'Tableau native null should take precedence over its formatted label.'
    );
    assert(!isMissingHierarchyValue('NULL'), 'The literal domain value NULL should remain valid.');
    assert(
        !isMissingHierarchyValue({ value: 'Null', nativeValue: 'Null', formattedValue: 'Null' }),
        'A real domain value named Null should remain valid.'
    );
}

testFlatVariableDepthAndNulls();
testFlatInternalGapAndUniquePaths();
testEndpointParentAndSelection();
testRecursiveSelection();
testTableauGetterCellsAndPartialSelection();
testControlledOpenNodeToggle();
testMissingValueRules();
console.log('TreeModel acceptance tests passed.');
