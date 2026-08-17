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
        searchText: '  bush ',
        selectedValues: ['bush', 'hon', 'removed-value', 'bush']
    });
    assert(
        state.openNodes.join(',')===`${ paths.furniture },${ paths.bookcases }`,
        'Refresh should retain unique expanded branches that still exist.'
    );
    assert(state.searchText==='  bush ', 'Refresh should retain the exact search text.');
    assert(state.selectedValues.join(',')==='bush,hon', 'Refresh should retain selectable values that still exist.');
}

function testSelectionBehaviorControlsAvailableValues(): void {
    const tree=makeTree();
    const state=reconcileHierarchyUiState(tree, {
        openNodes: [],
        searchText: '',
        selectedValues: ['bush', 'Furniture|Bookcases']
    }, SelectionBehavior.NODE);
    assert(state.selectedValues.includes('bush'), 'Direct node values should survive node-only refreshes.');
    assert(
        !state.selectedValues.includes('Furniture|Bookcases'),
        'Values not represented by source rows should be removed from node-only selections.'
    );
}

function testRemovedBranchIsCollapsedAfterRefresh(): void {
    const original=makeTree();
    const furniture=original[0];
    const chairs=furniture.nodes.find(node => node.label==='Chairs')!;
    const removedPath=`${ furniture.key }/${ chairs.key }`;
    const refreshed=buildFlatTree([
        ['Furniture', 'Bookcases', 'Bush', 'bush']
    ], [0, 1, 2], 3);
    const state=reconcileHierarchyUiState(refreshed, {
        openNodes: [furniture.key, removedPath],
        searchText: 'hon',
        selectedValues: ['hon']
    });
    assert(state.openNodes.length===1&&state.openNodes[0]===furniture.key, 'Removed branches should not stay expanded.');
    assert(state.selectedValues.length===0, 'Removed filter values should not remain selected.');
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
        searchText: 'Bush',
        selectedValues: ['bush', 'bush', 'hon']
    });
    const restored=loadHierarchyUiState(storage, key);
    assert(
        key.includes('Sales%20dashboard:42:'),
        'Storage keys should identify the dashboard and extension object.'
    );
    assert(restored.openNodes.join(',')==='root', 'Stored expanded paths should be deduplicated.');
    assert(restored.searchText==='Bush', 'Stored search text should be restored exactly.');
    assert(restored.selectedValues.join(',')==='bush,hon', 'Stored selections should be deduplicated.');
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

testRefreshPreservesSurvivingUiState();
testSelectionBehaviorControlsAvailableValues();
testRemovedBranchIsCollapsedAfterRefresh();
testSessionStorageRoundTrip();
testCorruptStoredStateFallsBackSafely();
console.log('Hierarchy UI state acceptance tests passed.');
