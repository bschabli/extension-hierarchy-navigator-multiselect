import {
    SelectionBehavior,
    getLegacySelectionBehavior,
    resolveSavedSelectionBehavior
} from '../API/SelectionBehavior';
import {
    buildFlatTree,
    buildRecursiveTree,
    getAllSelectableFilterValues,
    getNodeSelectionValues,
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
    assert(parent.directFilterValues.join(',')==='row-b', 'Endpoint parent must retain its own direct row value.');
    assert(parent.terminalFilterValues.join(',')==='row-c,row-d', 'Leaf mode must exclude an intermediate endpoint value.');
    assert(parent.subtreeFilterValues.join(',')==='row-b,row-c,row-d', 'Subtree mode must retain every represented row.');
    let selected=toggleNodeSelection(parent, new Set<string>(['row-y']), SelectionBehavior.SUBTREE);
    assert(selected.size===4&&selected.has('row-y'), 'Parent selection must preserve unrelated values.');
    selected.delete('row-c');
    assert(getSelectionState(parent, selected, SelectionBehavior.SUBTREE)==='some', 'A partially selected parent must be indeterminate.');
    selected=toggleNodeSelection(parent, selected, SelectionBehavior.SUBTREE);
    assert(getSelectionState(parent, selected, SelectionBehavior.SUBTREE)==='all', 'Toggling an indeterminate parent should select all descendants.');
    selected=toggleNodeSelection(parent, selected, SelectionBehavior.SUBTREE);
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
    assert(tree[0].terminalFilterValues.join(',')==='A11,A2', 'Recursive parents select leaves at variable depths.');
    assert(tree[0].subtreeFilterValues.join(',')==='A,A1,A11,A2', 'Recursive subtree mode should include intermediate IDs.');
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
    assert(root.terminalFilterValues.join(',')==='atlantic-id,bush-id', 'Getter-backed filter values must remain distinct.');

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

function testCollectAllLeafFilterValues(): void {
    const tree=buildFlatTree([
        ['A', 'A1', 'a1'],
        ['A', 'A2', 'a2'],
        ['B', 'B1', 'b1'],
        ['B', 'B2', 'a1']
    ], [0, 1], 2);
    assert(
        getAllSelectableFilterValues(tree).join(',')==='a1,a2,b1',
        'Select all should collect each leaf filter value exactly once.'
    );
}

function testSelectionBehaviors(): void {
    const tree=buildRecursiveTree([
        [null, 'root', 'Root'],
        ['root', 'branch', 'Branch'],
        ['branch', 'leaf-a', 'Leaf A'],
        ['branch', 'leaf-b', 'Leaf B']
    ], 0, 1, 2);
    const root=tree[0];
    const branch=root.nodes[0];
    assert(
        getNodeSelectionValues(branch, SelectionBehavior.NODE).join(',')==='branch',
        'Node-only mode should control only the clicked node ID.'
    );
    assert(
        getNodeSelectionValues(branch, SelectionBehavior.TERMINAL).join(',')==='leaf-a,leaf-b',
        'Terminal mode should control only visual leaf IDs.'
    );
    assert(
        getNodeSelectionValues(branch, SelectionBehavior.SUBTREE).join(',')==='branch,leaf-a,leaf-b',
        'Subtree mode should include the clicked node and every represented descendant.'
    );
    assert(
        getAllSelectableFilterValues(tree, SelectionBehavior.NODE).join(',')==='root,branch,leaf-a,leaf-b',
        'Select all in node-only mode should still select every directly represented node.'
    );
    assert(
        getLegacySelectionBehavior('flat')===SelectionBehavior.SUBTREE,
        'Saved Flat configurations should preserve the former all-endpoints behavior.'
    );
    assert(
        getLegacySelectionBehavior('recursive')===SelectionBehavior.TERMINAL,
        'Saved Recursive configurations should preserve the former terminal-descendants behavior.'
    );
    assert(
        resolveSavedSelectionBehavior(undefined, false, 'flat')===SelectionBehavior.TERMINAL,
        'Incomplete configurations should keep the current terminal-value default.'
    );
    assert(
        resolveSavedSelectionBehavior(undefined, true, 'flat')===SelectionBehavior.SUBTREE,
        'Completed legacy Flat configurations should preserve their previous subtree behavior.'
    );
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
    assert(
        isMissingHierarchyValue(new TableauGetterCell(null, 'Null')),
        'Prototype getter-backed native nulls should take precedence over formatted labels.'
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
testCollectAllLeafFilterValues();
testSelectionBehaviors();
testMissingValueRules();
console.log('TreeModel acceptance tests passed.');
