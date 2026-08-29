import { SelectionBehavior } from '../API/SelectionBehavior';
import {
    buildFlatTree,
    buildRecursiveTree,
    getAllSelectableFilterValues
} from './TreeModel';
import {
    buildHierarchyFilterValueRecords,
    getHierarchyDepth,
    resolveMappedFilterValues
} from './FilterTargetValues';

function assert(condition: boolean, message: string): void {
    if(!condition) { throw new Error(message); }
}

const flatTree=buildFlatTree([
    ['Furniture', 'Chairs', 'CHAIR-1'],
    ['Furniture', 'Tables', 'TABLE-1']
], [0, 1], 2, ' → ');
const flatIds=getAllSelectableFilterValues(flatTree, SelectionBehavior.TERMINAL);
const flatRecords=buildHierarchyFilterValueRecords(flatTree, flatIds, ' → ');

assert(flatRecords.length===2, 'Every selected Flat ID should produce one mapping record.');
assert(
    resolveMappedFilterValues({ valueSource: 'id' }, flatRecords).join(',')==='CHAIR-1,TABLE-1',
    'The ID mapping should preserve unique source IDs.'
);
assert(
    resolveMappedFilterValues({ valueSource: 'label' }, flatRecords).join(',')==='Chairs,Tables',
    'The label mapping should use the visible owning-node labels.'
);
assert(
    resolveMappedFilterValues({ valueSource: 'path' }, flatRecords).join(',')===
        'Furniture → Chairs,Furniture → Tables',
    'The path mapping should use the configured separator.'
);
assert(
    resolveMappedFilterValues({ valueSource: 'level', levelIndex: 0 }, flatRecords).join(',')==='Furniture',
    'Level mappings should remove duplicate source values.'
);
assert(
    resolveMappedFilterValues({ valueSource: 'level', levelIndex: 1 }, flatRecords).join(',')==='Chairs,Tables',
    'Flat level mappings should use values at the original field positions.'
);
assert(getHierarchyDepth(flatTree)===2, 'Flat tree depth should reflect the deepest visible branch.');

const recursiveTree=buildRecursiveTree([
    [null, 'ROOT', 'Furniture'],
    ['ROOT', 'CHAIR-1', 'Chairs']
], 0, 1, 2);
const recursiveRecords=buildHierarchyFilterValueRecords(
    recursiveTree,
    ['CHAIR-1'],
    ' / '
);
assert(
    resolveMappedFilterValues({ valueSource: 'path' }, recursiveRecords)[0]==='Furniture / Chairs',
    'Recursive path mappings should include ancestor labels.'
);
assert(
    resolveMappedFilterValues({ valueSource: 'level', levelIndex: 0 }, recursiveRecords)[0]==='Furniture',
    'Recursive level mappings should use visual ancestor levels.'
);
assert(getHierarchyDepth(recursiveTree)===2, 'Recursive depth should be derived from the tree.');

console.log('Filter target value mapping tests passed.');
