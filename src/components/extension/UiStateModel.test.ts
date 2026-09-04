import { SelectionBehavior } from '../API/SelectionBehavior';
import { buildFlatTree } from './TreeModel';
import {
    HierarchyUiStorage,
    createHierarchyUiStorageKey,
    loadHierarchyUiState,
    reconcileHierarchyUiState,
    saveHierarchyUiState
} from './UiStateModel';

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

function getBranchPaths(): { bookcases: string, furniture: string; } {
    const tree=makeTree();
    const furniture=tree[0];
    const bookcases=furniture.nodes.find(node => node.label==='Bookcases')!;
    return {
        bookcases: `${ furniture.key }/${ bookcases.key }`,
        furniture: furniture.key
    };
}

function testRefreshPreservesSurvivingUiState(): void {
    const paths=getBranchPaths();
    const state=reconcileHierarchyUiState(makeTree(), {
        openNodes: [paths.furniture, paths.bookcases, 'missing/path', paths.furniture],
        recentNodeKeys: [makeTree()[0].key, 'missing-node'],
        searchText: '  bush ',
        selectedValues: ['bush', 'hon', 'removed-value', 'bush'],
        showSelectedOnly: true
    });
    assert(
        state.openNodes.join(',')===`${ paths.furniture },${ paths.bookcases },missing/path`,
        'Refresh should retain unique expansion intent while Tableau data may be temporarily filtered.'
    );
    assert(state.searchText==='  bush ', 'Refresh should retain the exact search text.');
    assert(state.selectedValues.join(',')==='bush,hon', 'Refresh should retain selectable values that still exist.');
    assert(
        state.recentNodeKeys.length===2,
        'Refresh should retain recent-item intent while Tableau data may be temporarily filtered.'
    );
    assert(state.showSelectedOnly, 'Refresh should retain selected-only mode.');
}

function testSelectionBehaviorControlsAvailableValues(): void {
    const tree=makeTree();
    const state=reconcileHierarchyUiState(tree, {
        openNodes: [],
        recentNodeKeys: [],
        searchText: '',
        selectedValues: ['bush', 'Furniture|Bookcases'],
        showSelectedOnly: false
    }, SelectionBehavior.NODE);
    assert(state.selectedValues.includes('bush'), 'Direct node values should survive node-only refreshes.');
    assert(
        !state.selectedValues.includes('Furniture|Bookcases'),
        'Values not represented by source rows should be removed from node-only selections.'
    );
}

function testTemporarilyRemovedBranchRetainsExpansionIntent(): void {
    const original=makeTree();
    const furniture=original[0];
    const chairs=furniture.nodes.find(node => node.label==='Chairs')!;
    const removedPath=`${ furniture.key }/${ chairs.key }`;
    const refreshed=buildFlatTree([
        ['Furniture', 'Bookcases', 'Bush', 'bush']
    ], [0, 1, 2], 3);
    const state=reconcileHierarchyUiState(refreshed, {
        openNodes: [furniture.key, removedPath],
        recentNodeKeys: [chairs.key],
        searchText: 'hon',
        selectedValues: ['hon'],
        showSelectedOnly: true
    });
    assert(
        state.openNodes.includes(removedPath),
        'A branch temporarily removed by Tableau filtering should reopen when its rows return.'
    );
    assert(state.selectedValues.length===0, 'Removed filter values should not remain selected.');
    assert(
        state.recentNodeKeys.includes(chairs.key),
        'Temporarily removed nodes should remain available to the recent-item history when they return.'
    );
    assert(state.searchText==='hon', 'A zero-result search should remain available after refresh.');
}

function testSessionStorageRoundTrip(): void {
    const values=new Map<string, string>();
    const storage: HierarchyUiStorage={
        getItem: key => values.get(key)||null,
        setItem: (key, value) => { values.set(key, value); }
    };
    const key=createHierarchyUiStorageKey('Sales dashboard', 42, 'unused');
    saveHierarchyUiState(storage, key, {
        openNodes: ['root', 'root'],
        recentNodeKeys: ['bush-node', 'bush-node', 'hon-node'],
        searchText: 'Bush',
        selectedValues: ['bush', 'bush', 'hon'],
        showSelectedOnly: true
    });
    const restored=loadHierarchyUiState(storage, key);
    assert(
        key.includes('Sales%20dashboard:42:'),
        'Storage keys should identify the dashboard and extension object.'
    );
    assert(restored.openNodes.join(',')==='root', 'Stored expanded paths should be deduplicated.');
    assert(restored.searchText==='Bush', 'Stored search text should be restored exactly.');
    assert(restored.selectedValues.join(',')==='bush,hon', 'Stored selections should be deduplicated.');
    assert(restored.recentNodeKeys.join(',')==='bush-node,hon-node', 'Recent nodes should be deduplicated.');
    assert(restored.showSelectedOnly, 'Selected-only mode should survive a session storage round trip.');
}

function testCorruptStoredStateFallsBackSafely(): void {
    const storage: HierarchyUiStorage={
        getItem: () => '{not-json',
        setItem: () => undefined
    };
    const restored=loadHierarchyUiState(storage, 'test');
    assert(
        restored.openNodes.length===0&&restored.searchText===''&&restored.selectedValues.length===0,
        'Corrupt session state should fall back to an empty UI state.'
    );
    const first=createHierarchyUiStorageKey('Dashboard', 42, 'source-a');
    const second=createHierarchyUiStorageKey('Dashboard', 42, 'source-b');
    assert(first!==second, 'Different hierarchy definitions should not share persisted UI state.');
}

function testStoredArraysAreBoundedBeforeDeduplication(): void {
    const oversizedValues=Array.from({ length: 10001 }, () => 'duplicate').concat('outside-cap');
    const storage: HierarchyUiStorage={
        getItem: () => JSON.stringify({
            openNodes: oversizedValues,
            recentNodeKeys: oversizedValues,
            selectedValues: oversizedValues
        }),
        setItem: () => undefined
    };
    const restored=loadHierarchyUiState(storage, 'test');
    assert(
        restored.openNodes.join(',')==='duplicate'&&restored.selectedValues.join(',')==='duplicate',
        'Corrupt arrays should be capped before deduplication so later entries are never traversed.'
    );
    assert(restored.recentNodeKeys.join(',')==='duplicate', 'Recent nodes should also be capped and deduplicated.');
}

testRefreshPreservesSurvivingUiState();
testSelectionBehaviorControlsAvailableValues();
testTemporarilyRemovedBranchRetainsExpansionIntent();
testSessionStorageRoundTrip();
testCorruptStoredStateFallsBackSafely();
testStoredArraysAreBoundedBeforeDeduplication();
console.log('Hierarchy UI state acceptance tests passed.');
