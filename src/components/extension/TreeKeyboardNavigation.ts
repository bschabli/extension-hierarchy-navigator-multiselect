export interface KeyboardTreeItem {
    hasNodes: boolean;
    isOpen: boolean;
    key: string;
    label: string;
}

export type TreeKeyboardAction=
    { type: 'collapse', key: string }|
    { type: 'expand', key: string }|
    { type: 'select', key: string }|
    { type: 'expand-siblings', keys: string[] }|
    { type: 'focus', key: string }|
    { type: 'none' };

/** Resolve a WAI-ARIA tree keyboard command without touching the DOM. */
export function getTreeKeyboardAction(
    items: readonly KeyboardTreeItem[],
    currentKey: string,
    pressedKey: string,
    allowToggle=true
): TreeKeyboardAction {
    const currentIndex=items.findIndex(item => item.key===currentKey);
    if(currentIndex<0) { return { type: 'none' }; }
    const current=items[currentIndex];

    switch(pressedKey) {
        case 'ArrowDown':
            return currentIndex<items.length-1?{ type: 'focus', key: items[currentIndex+1].key }:{ type: 'none' };
        case 'ArrowUp':
            return currentIndex>0?{ type: 'focus', key: items[currentIndex-1].key }:{ type: 'none' };
        case 'Home':
            return items.length>0?{ type: 'focus', key: items[0].key }:{ type: 'none' };
        case 'End':
            return items.length>0?{ type: 'focus', key: items[items.length-1].key }:{ type: 'none' };
        case 'ArrowRight': {
            if(current.hasNodes&&!current.isOpen&&allowToggle) { return { type: 'expand', key: current.key }; }
            const child=items[currentIndex+1];
            return current.hasNodes&&current.isOpen&&child&&getParentKey(child.key)===current.key?
                { type: 'focus', key: child.key }:{ type: 'none' };
        }
        case 'ArrowLeft':
            if(current.hasNodes&&current.isOpen&&allowToggle) { return { type: 'collapse', key: current.key }; }
            return getParentKey(current.key)?{ type: 'focus', key: getParentKey(current.key) }:{ type: 'none' };
        case 'Enter':
        case ' ':
        case 'Spacebar':
            return { type: 'select', key: current.key };
        case '*': {
            if(!allowToggle) { return { type: 'none' }; }
            const parentKey=getParentKey(current.key);
            const keys=items
                .filter(item => item.hasNodes&&getParentKey(item.key)===parentKey)
                .map(item => item.key);
            return keys.length>0?{ type: 'expand-siblings', keys }:{ type: 'none' };
        }
        default:
            return { type: 'none' };
    }
}

/** Find the next visible item whose label starts with the typed text. */
export function findTypeaheadTreeItem(
    items: readonly KeyboardTreeItem[],
    currentKey: string,
    query: string
): string|undefined {
    const normalizedQuery=query.trim().toLocaleLowerCase();
    if(normalizedQuery==='') { return undefined; }
    const startIndex=Math.max(0, items.findIndex(item => item.key===currentKey));
    for(let offset=1;offset<=items.length;offset++) {
        const candidate=items[(startIndex+offset)%items.length];
        if(candidate.label.toLocaleLowerCase().startsWith(normalizedQuery)) { return candidate.key; }
    }
    return undefined;
}

function getParentKey(key: string): string {
    const separatorIndex=key.lastIndexOf('/');
    return separatorIndex<0?'':key.slice(0, separatorIndex);
}
