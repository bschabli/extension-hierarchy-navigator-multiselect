import { SelectionBehavior } from '../API/SelectionBehavior';
import { NormalizedTreeNode, getAllSelectableFilterValues } from './TreeModel';

export interface HierarchyUiState {
    openNodes: string[];
    searchText: string;
    selectedValues: string[];
}

export interface HierarchyUiStorage {
    getItem: (key: string) => string|null;
    setItem: (key: string, value: string) => void;
}

const EMPTY_UI_STATE: HierarchyUiState={ openNodes: [], searchText: '', selectedValues: [] };

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
            searchText: typeof parsed.searchText==='string'?parsed.searchText.slice(0, 1000):'',
            selectedValues: stringArray(parsed.selectedValues)
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
            openNodes: unique(state.openNodes),
            searchText: state.searchText.slice(0, 1000),
            selectedValues: unique(state.selectedValues)
        }));
    }
    catch(_error) {
        // Session storage may be unavailable in more restrictive Tableau hosts.
        // In-memory refresh preservation continues to work in that case.
    }
}

/**
 * Keep refresh-safe UI values that still exist in the latest hierarchy.
 *
 * Search text is user input rather than hierarchy data, so it is retained
 * verbatim. Expanded paths and selected filter values are removed only when
 * their corresponding branch or value no longer exists after the refresh.
 */
export function reconcileHierarchyUiState(
    nodes: readonly NormalizedTreeNode[],
    currentState: HierarchyUiState,
    selectionBehavior=SelectionBehavior.TERMINAL
): HierarchyUiState {
    const availableOpenPaths=new Set<string>();

    function addOpenPaths(currentNodes: readonly NormalizedTreeNode[], parentPath: string): void {
        currentNodes.forEach(node => {
            const path=parentPath===''?node.key:`${ parentPath }/${ node.key }`;
            if(node.nodes.length>0) { availableOpenPaths.add(path); }
            addOpenPaths(node.nodes, path);
        });
    }

    addOpenPaths(nodes, '');
    const selectableValues=new Set(getAllSelectableFilterValues(nodes, selectionBehavior));
    return {
        openNodes: unique(currentState.openNodes).filter(path => availableOpenPaths.has(path)),
        searchText: currentState.searchText,
        selectedValues: unique(currentState.selectedValues).filter(value => selectableValues.has(value))
    };
}

function unique(values: readonly string[]): string[] {
    return Array.from(new Set(values));
}

function stringArray(value: unknown): string[] {
    if(!Array.isArray(value)) { return []; }
    return unique(value.slice(0, 10000).filter((item): item is string => typeof item==='string'));
}

function copyEmptyState(): HierarchyUiState {
    return {
        openNodes: EMPTY_UI_STATE.openNodes.slice(),
        searchText: EMPTY_UI_STATE.searchText,
        selectedValues: EMPTY_UI_STATE.selectedValues.slice()
    };
}

function hashString(value: string): string {
    let hash=2166136261;
    for(let index=0;index<value.length;index++) {
        hash=Math.imul(hash^value.charCodeAt(index), 16777619);
    }
    return (hash>>>0).toString(36);
}
