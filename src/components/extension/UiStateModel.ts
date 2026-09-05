import { SelectionBehavior } from '../API/SelectionBehavior';
import { NormalizedTreeNode, getAllSelectableFilterValues } from './TreeModel';
import { MAX_OPEN_NODE_PATHS } from './NavigationModel';

export interface HierarchyUiState {
    openNodes: string[];
    recentNodeKeys: string[];
    searchText: string;
    selectedValues: string[];
    showSelectedOnly: boolean;
}

export interface HierarchyUiStorage {
    getItem: (key: string) => string|null;
    setItem: (key: string, value: string) => void;
}

const EMPTY_UI_STATE: HierarchyUiState={
    openNodes: [],
    recentNodeKeys: [],
    searchText: '',
    selectedValues: [],
    showSelectedOnly: false
};

/** Create a per-dashboard-extension-definition key for browser-session persistence. */
export function createHierarchyUiStorageKey(
    dashboardName: string,
    dashboardObjectId: unknown,
    hierarchyDefinitionSignature: string
): string {
    const instanceId=(typeof dashboardObjectId==='number'||typeof dashboardObjectId==='string')&&
        String(dashboardObjectId)!==''?String(dashboardObjectId):'unknown-extension';
    return [
        'hierarchy-navigator:ui:v1',
        encodeURIComponent(dashboardName),
        encodeURIComponent(instanceId),
        hashString(hierarchyDefinitionSignature)
    ].join(':');
}

/** Load validated UI state without allowing corrupt session data to break the extension. */
export function loadHierarchyUiState(storage: HierarchyUiStorage|undefined, key: string): HierarchyUiState {
    if(!storage) { return copyEmptyState(); }
    try {
        const serialized=storage.getItem(key);
        if(serialized===null) { return copyEmptyState(); }
        const parsed=JSON.parse(serialized) as Partial<HierarchyUiState>;
        return {
            openNodes: stringArray(parsed.openNodes),
            recentNodeKeys: stringArray(parsed.recentNodeKeys).slice(0, 8),
            searchText: typeof parsed.searchText==='string'?parsed.searchText.slice(0, 1000):'',
            selectedValues: stringArray(parsed.selectedValues),
            showSelectedOnly: parsed.showSelectedOnly===true
        };
    }
    catch(_error) {
        return copyEmptyState();
    }
}

/** Store UI state for the lifetime of the current browser dashboard session. */
export function saveHierarchyUiState(
    storage: HierarchyUiStorage|undefined,
    key: string,
    state: HierarchyUiState
): void {
    if(!storage) { return; }
    try {
        storage.setItem(key, JSON.stringify({
            openNodes: newestUnique(state.openNodes, MAX_OPEN_NODE_PATHS),
            recentNodeKeys: unique(state.recentNodeKeys).slice(0, 8),
            searchText: state.searchText.slice(0, 1000),
            selectedValues: unique(state.selectedValues),
            showSelectedOnly: state.showSelectedOnly
        }));
    }
    catch(_error) {
        // Session storage may be unavailable in more restrictive Tableau hosts.
        // In-memory refresh preservation continues to work in that case.
    }
}

/**
 * Reconcile UI state while retaining intent that may be temporarily absent.
 *
 * Search text is user input rather than hierarchy data, so it is retained
 * verbatim. Expansion and recent-item intent is retained because dashboard
 * filtering can temporarily remove rows. Selected values are removed when
 * they are no longer present in the current hierarchy.
 */
export function reconcileHierarchyUiState(
    nodes: readonly NormalizedTreeNode[],
    currentState: HierarchyUiState,
    selectionBehavior=SelectionBehavior.TERMINAL
): HierarchyUiState {
    const currentSelectedValues=unique(currentState.selectedValues);
    const selectedValues=currentSelectedValues.length===0?[]:(() => {
        const selectableValues=new Set(getAllSelectableFilterValues(nodes, selectionBehavior));
        return currentSelectedValues.filter(value => selectableValues.has(value));
    })();
    return {
        // Keep expansion intent for branches temporarily absent from filtered
        // Tableau summary data. Unknown paths are inert and are capped when loaded.
        openNodes: newestUnique(currentState.openNodes, MAX_OPEN_NODE_PATHS),
        recentNodeKeys: unique(currentState.recentNodeKeys).slice(0, 8),
        searchText: currentState.searchText,
        selectedValues,
        showSelectedOnly: currentState.showSelectedOnly&&selectedValues.length>0
    };
}

function unique(values: readonly string[]): string[] {
    return Array.from(new Set(values));
}

/** Retain the newest distinct values without traversing older values once the limit is full. */
function newestUnique(values: readonly string[], limit: number): string[] {
    const seen=new Set<string>();
    const newestValues: string[]=[];
    for(let index=values.length-1;index>=0&&newestValues.length<limit;index--) {
        const value=values[index];
        if(seen.has(value)) { continue; }
        seen.add(value);
        newestValues.push(value);
    }
    return newestValues.reverse();
}

function stringArray(value: unknown): string[] {
    if(!Array.isArray(value)) { return []; }
    return unique(value.slice(0, 10000).filter((item): item is string => typeof item==='string'));
}

function copyEmptyState(): HierarchyUiState {
    return {
        openNodes: EMPTY_UI_STATE.openNodes.slice(),
        recentNodeKeys: EMPTY_UI_STATE.recentNodeKeys.slice(),
        searchText: EMPTY_UI_STATE.searchText,
        selectedValues: EMPTY_UI_STATE.selectedValues.slice(),
        showSelectedOnly: EMPTY_UI_STATE.showSelectedOnly
    };
}

function hashString(value: string): string {
    let hash=2166136261;
    for(let index=0;index<value.length;index++) {
        hash=Math.imul(hash^value.charCodeAt(index), 16777619);
    }
    return (hash>>>0).toString(36);
}
