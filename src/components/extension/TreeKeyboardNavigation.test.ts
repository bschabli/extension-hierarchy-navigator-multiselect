import {
    KeyboardTreeItem,
    findTypeaheadTreeItem,
    getTreeKeyboardAction
} from './TreeKeyboardNavigation';

function assert(condition: boolean, message: string): void {
    if(!condition) { throw new Error(message); }
}

function actionKey(action: ReturnType<typeof getTreeKeyboardAction>): string|undefined {
    return 'key' in action?action.key:undefined;
}

const items: KeyboardTreeItem[]=[
    { key: 'furniture', label: 'Furniture', hasNodes: true, isOpen: true },
    { key: 'furniture/chairs', label: 'Chairs', hasNodes: false, isOpen: false },
    { key: 'office', label: 'Office Supplies', hasNodes: true, isOpen: false },
    { key: 'technology', label: 'Technology', hasNodes: false, isOpen: false }
];

function testLinearNavigation(): void {
    assert(
        actionKey(getTreeKeyboardAction(items, 'furniture', 'ArrowDown'))==='furniture/chairs',
        'Arrow Down should focus the next visible item.'
    );
    assert(
        actionKey(getTreeKeyboardAction(items, 'technology', 'ArrowUp'))==='office',
        'Arrow Up should focus the previous visible item.'
    );
    assert(
        actionKey(getTreeKeyboardAction(items, 'office', 'Home'))==='furniture',
        'Home should focus the first item.'
    );
    assert(
        actionKey(getTreeKeyboardAction(items, 'office', 'End'))==='technology',
        'End should focus the last item.'
    );
}

function testHierarchicalNavigation(): void {
    const childAction=getTreeKeyboardAction(items, 'furniture', 'ArrowRight');
    assert(
        childAction.type==='focus'&&childAction.key==='furniture/chairs',
        'Arrow Right should enter an expanded branch.'
    );
    const parentAction=getTreeKeyboardAction(items, 'furniture/chairs', 'ArrowLeft');
    assert(
        parentAction.type==='focus'&&parentAction.key==='furniture',
        'Arrow Left should return to the parent of a leaf.'
    );
    const expandAction=getTreeKeyboardAction(items, 'office', 'ArrowRight');
    assert(expandAction.type==='expand'&&expandAction.key==='office', 'Arrow Right should expand a closed branch.');
    const collapseAction=getTreeKeyboardAction(items, 'furniture', 'ArrowLeft');
    assert(
        collapseAction.type==='collapse'&&collapseAction.key==='furniture',
        'Arrow Left should collapse an expanded branch.'
    );
}

function testSelectionAndSiblingExpansion(): void {
    assert(getTreeKeyboardAction(items, 'office', ' ').type==='select', 'Space should toggle the current selection.');
    assert(getTreeKeyboardAction(items, 'office', 'Enter').type==='select', 'Enter should toggle the current selection.');
    const action=getTreeKeyboardAction(items, 'office', '*');
    assert(
        action.type==='expand-siblings'&&action.keys.join(',')==='furniture,office',
        'Asterisk should expand all sibling branches.'
    );
}

function testTypeaheadNavigation(): void {
    assert(
        findTypeaheadTreeItem(items, 'furniture', 'o')==='office',
        'Typeahead should find the next visible matching label.'
    );
    assert(
        findTypeaheadTreeItem(items, 'technology', 'f')==='furniture',
        'Typeahead should wrap from the last item to the first.'
    );
}

testLinearNavigation();
testHierarchicalNavigation();
testSelectionAndSiblingExpansion();
testTypeaheadNavigation();
console.log('Hierarchy keyboard navigation acceptance tests passed.');
