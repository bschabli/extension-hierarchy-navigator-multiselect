import { SelectionBehavior } from '../API/SelectionBehavior';
import { buildFlatTree } from './TreeModel';
import {
    collapseHierarchyLevel,
    expandHierarchyLevel,
    filterHierarchyToSelection,
    getAncestorPaths,
    getHierarchyBreadcrumbs,
    getHierarchyLevelCount,
    getHierarchyLevelSelectionValues,
    getHierarchyNavigationEntries,
    MAX_OPEN_NODE_PATHS,
    revealHierarchyPath,
    updateHierarchyLevelSelection
} from './NavigationModel';

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

function testNavigationMetadata(): void {
    const tree=makeTree();
    const entries=getHierarchyNavigationEntries(tree);
    const bush=entries.find(entry => entry.node.label==='Bush')!;
    assert(getHierarchyLevelCount(tree)===3, 'The deepest visual level should determine the level count.');
    assert(bush.depth===2, 'Flattened entries should retain their zero-based visual depth.');
    assert(
        getHierarchyBreadcrumbs(tree, bush.node.key).map(node => node.label).join(' > ')===
            'Furniture > Bookcases > Bush',
        'Breadcrumbs should include every ancestor and the active node.'
    );
    assert(getAncestorPaths(bush.path).length===2, 'Ancestor paths should exclude the active item by default.');
    const revealed=revealHierarchyPath(['other/open/branch'], bush.path);
    assert(
        revealed.includes('other/open/branch')&&revealed.length===3,
        'Revealing an active item should preserve existing expansion state.'
    );
    const oversizedOpenPaths=Array.from({ length: MAX_OPEN_NODE_PATHS+2 }, (_value, index) => `path-${ index }`);
    const bounded=revealHierarchyPath(oversizedOpenPaths, bush.path);
    assert(bounded.length===MAX_OPEN_NODE_PATHS, 'Revealed expansion state should remain bounded.');
    assert(
        getAncestorPaths(bush.path).every(path => bounded.includes(path)),
        'The active item ancestors should be retained when older expansion paths are evicted.'
    );
    assert(
        !bounded.includes('path-0')&&!bounded.includes('path-1')&&bounded.includes(`path-${ MAX_OPEN_NODE_PATHS+1 }`),
        'Bounded reveals should evict the oldest unrelated paths and retain the newest ones.'
    );
}

function testSelectedOnlyTree(): void {
    const filtered=filterHierarchyToSelection(makeTree(), new Set(['bush']));
    assert(filtered.length===1&&filtered[0].label==='Furniture', 'Selected-only mode should retain ancestor context.');
    assert(
        filtered[0].nodes[0].nodes.length===1&&filtered[0].nodes[0].nodes[0].label==='Bush',
        'Unselected sibling branches should be removed.'
    );
    assert(
        filterHierarchyToSelection(makeTree(), new Set(), SelectionBehavior.SUBTREE).length===0,
        'An empty selection should produce an empty selected-only tree.'
    );
}

function testLevelActions(): void {
    const tree=makeTree();
    const levelValues=getHierarchyLevelSelectionValues(tree, 1, SelectionBehavior.TERMINAL);
    assert(
        levelValues.length===4&&levelValues.includes('bush')&&levelValues.includes('avery'),
        'A level selection should contain every value controlled by nodes at that level.'
    );
    const expanded=expandHierarchyLevel(tree, 1, []);
    assert(
        expanded.some(path => path.includes('Bookcases'))&&expanded.includes(tree[0].key),
        'Expanding a level should reveal its ancestors and open each branch on that level.'
    );
    const collapsed=collapseHierarchyLevel(tree, 0, expanded);
    assert(collapsed.length===0, 'Collapsing a level should remove its descendant expansion state.');
    const selected=updateHierarchyLevelSelection(tree, 2, new Set(['unrelated']), true);
    assert(
        selected.size===5&&selected.has('unrelated')&&selected.has('hon'),
        'Selecting a level should preserve unrelated selections.'
    );
    const cleared=updateHierarchyLevelSelection(tree, 2, selected, false);
    assert(
        cleared.size===1&&cleared.has('unrelated'),
        'Clearing a level should leave unrelated selections untouched.'
    );
}

testNavigationMetadata();
testSelectedOnlyTree();
testLevelActions();
console.log('Hierarchy navigation model acceptance tests passed.');
