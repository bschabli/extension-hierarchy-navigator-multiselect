export enum SelectionBehavior {
    TERMINAL='terminal',
    SUBTREE='subtree',
    NODE='node'
}

/** Return whether a saved value is a supported selection behavior. */
export function isSelectionBehavior(value: unknown): value is SelectionBehavior {
    return value===SelectionBehavior.TERMINAL||
        value===SelectionBehavior.SUBTREE||
        value===SelectionBehavior.NODE;
}

/** Preserve the selection semantics used before this option was configurable. */
export function getLegacySelectionBehavior(hierarchyType: unknown): SelectionBehavior {
    return hierarchyType==='flat'?SelectionBehavior.SUBTREE:SelectionBehavior.TERMINAL;
}

/** Resolve saved behavior without applying legacy migration to incomplete configurations. */
export function resolveSavedSelectionBehavior(
    savedValue: unknown,
    configComplete: unknown,
    hierarchyType: unknown
): SelectionBehavior {
    if(isSelectionBehavior(savedValue)) { return savedValue; }
    return configComplete?getLegacySelectionBehavior(hierarchyType):SelectionBehavior.TERMINAL;
}

/** Return the user-facing label for a selection behavior. */
export function getSelectionBehaviorLabel(value: SelectionBehavior): string {
    switch(value) {
        case SelectionBehavior.SUBTREE: return 'Entire subtree';
        case SelectionBehavior.NODE: return 'This node only';
        default: return 'Terminal values only';
    }
}
