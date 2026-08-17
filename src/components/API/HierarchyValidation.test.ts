import {
    HierarchyValidationCode,
    HierarchyValidationResult,
    validateFlatHierarchy,
    validateRecursiveHierarchy
} from './HierarchyValidation';

function assert(condition: boolean, message: string): void {
    if(!condition) { throw new Error(message); }
}

function failedCount(result: HierarchyValidationResult, code: HierarchyValidationCode): number {
    return result.checks.find(check => check.code===code)?.issueCount||0;
}

function testCleanFlatHierarchyWithVariableDepth(): void {
    const result=validateFlatHierarchy([
        ['Furniture', 'Bookcases', 'Atlantic', 'atlantic-id'],
        ['Furniture', 'Chairs', null, 'chairs-id'],
        ['Office Supplies', null, null, 'office-id']
    ], {
        idColumnIndex: 3,
        levelColumnIndexes: [0, 1, 2],
        levelFieldNames: ['Category', 'Sub-category', 'Manufacturer'],
        separator: '|'
    });
    assert(result.valid, 'Trailing blank levels should remain valid for variable-depth Flat hierarchies.');
    assert(result.rowsChecked===3, 'Every Flat source row should be counted.');
    assert(
        result.checks.find(check => check.code==='orphaned-children')?.status==='not-applicable',
        'Parent checks should be marked not applicable for Flat hierarchies.'
    );
}

function testFlatIssues(): void {
    const result=validateFlatHierarchy([
        ['Furniture', null, 'Atlantic', 'duplicate-id'],
        ['Furniture', 'Book|cases', null, 'duplicate-id'],
        [null, null, null, 'blank-path'],
        ['Technology', 'Phones', null, null]
    ], {
        idColumnIndex: 3,
        levelColumnIndexes: [0, 1, 2],
        levelFieldNames: ['Category', 'Sub-category', 'Manufacturer'],
        separator: '|'
    });
    assert(!result.valid, 'Invalid Flat rows should block saving.');
    assert(failedCount(result, 'duplicate-ids')===1, 'One duplicated Flat ID should be reported.');
    assert(failedCount(result, 'blank-labels')===2, 'An internal gap and empty path should report blank labels.');
    assert(failedCount(result, 'malformed-paths')===4, 'Internal gaps, separator collisions, empty paths, and blank IDs should be malformed.');
}

function testRecursiveIssues(): void {
    const result=validateRecursiveHierarchy([
        [null, 'root', 'Root'],
        ['missing-parent', 'orphan', 'Orphan'],
        ['cycle-b', 'cycle-a', 'Cycle A'],
        ['cycle-a', 'cycle-b', 'Cycle B'],
        ['self', 'self', 'Self cycle'],
        ['root', 'duplicate', 'First duplicate'],
        ['root', 'duplicate', 'Second duplicate'],
        ['root', 'blank-label', null],
        ['root', null, 'Missing ID']
    ], {
        idColumnIndex: 1,
        labelColumnIndex: 2,
        parentIdColumnIndex: 0
    });
    assert(!result.valid, 'Invalid recursive relationships should block saving.');
    assert(failedCount(result, 'duplicate-ids')===1, 'One duplicated recursive ID should be reported.');
    assert(failedCount(result, 'orphaned-children')===1, 'One missing parent should be reported.');
    assert(failedCount(result, 'circular-relationships')===2, 'A two-node cycle and self-cycle should be reported.');
    assert(failedCount(result, 'blank-labels')===1, 'A blank recursive display label should be reported.');
    assert(failedCount(result, 'malformed-paths')===1, 'A missing recursive child ID should be malformed.');
}

function testCleanRecursiveHierarchyAndZeroRoot(): void {
    const result=validateRecursiveHierarchy([
        [0, 'root', 'Root'],
        ['root', 'child', 'Child'],
        ['child', 'leaf', 'Leaf']
    ], {
        idColumnIndex: 1,
        labelColumnIndex: 2,
        parentIdColumnIndex: 0
    });
    assert(result.valid, 'A zero parent should be treated as a valid root marker.');
}

function testEmptyDataset(): void {
    const result=validateFlatHierarchy([], {
        idColumnIndex: 1,
        levelColumnIndexes: [0],
        separator: '|'
    });
    assert(!result.valid, 'An empty source worksheet should not pass validation.');
    assert(failedCount(result, 'malformed-paths')===1, 'An empty dataset should produce one blocking path issue.');
}

testCleanFlatHierarchyWithVariableDepth();
testFlatIssues();
testRecursiveIssues();
testCleanRecursiveHierarchyAndZeroRoot();
testEmptyDataset();
console.log('Hierarchy data validation tests passed.');
