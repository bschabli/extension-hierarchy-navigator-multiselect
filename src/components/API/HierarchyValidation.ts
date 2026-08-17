import { HierarchyCell, normalizeHierarchyValue } from '../extension/TreeModel';

export type HierarchyValidationCode=
    'duplicate-ids'|
    'orphaned-children'|
    'circular-relationships'|
    'blank-labels'|
    'malformed-paths';

export type HierarchyValidationStatus='passed'|'failed'|'not-applicable';

export interface HierarchyValidationCheck {
    code: HierarchyValidationCode;
    description: string;
    examples: string[];
    issueCount: number;
    status: HierarchyValidationStatus;
    title: string;
}

export interface HierarchyValidationResult {
    checks: HierarchyValidationCheck[];
    rowsChecked: number;
    valid: boolean;
}

export interface FlatHierarchyValidationOptions {
    idColumnIndex: number;
    levelColumnIndexes: number[];
    levelFieldNames?: string[];
    separator: string;
}

export interface RecursiveHierarchyValidationOptions {
    idColumnIndex: number;
    labelColumnIndex: number;
    parentIdColumnIndex: number;
}

interface CheckDefinition {
    failedDescription: (count: number) => string;
    passedDescription: string;
    title: string;
}

const MAX_EXAMPLES=3;

const CHECK_DEFINITIONS: { [code in HierarchyValidationCode]: CheckDefinition }={
    'duplicate-ids': {
        failedDescription: count => `${ count } ID${ count===1?' appears':'s appear' } more than once.`,
        passedDescription: 'Every populated ID appears once.',
        title: 'IDs are unique'
    },
    'orphaned-children': {
        failedDescription: count => `${ count } child${ count===1?' references':'ren reference' } a parent that is not present.`,
        passedDescription: 'Every populated parent ID exists in the source data.',
        title: 'Children have known parents'
    },
    'circular-relationships': {
        failedDescription: count => `${ count } circular relationship${ count===1?' was':'s were' } found.`,
        passedDescription: 'No item eventually points back to itself.',
        title: 'Relationships contain no cycles'
    },
    'blank-labels': {
        failedDescription: count => `${ count } row${ count===1?' has':'s have' } a required blank label.`,
        passedDescription: 'Every required hierarchy label is populated.',
        title: 'Labels are populated'
    },
    'malformed-paths': {
        failedDescription: count => `${ count } malformed hierarchy path${ count===1?' was':'s were' } found.`,
        passedDescription: 'Every row can be converted into an unambiguous hierarchy path.',
        title: 'Paths are well-formed'
    }
};

/** Validate rows from a hierarchy stored in separate level columns. */
export function validateFlatHierarchy(
    rows: HierarchyCell[][],
    options: FlatHierarchyValidationOptions
): HierarchyValidationResult {
    const idCounts=new Map<string, number>();
    const blankLabelRows=new Set<number>();
    const malformedRows=new Set<number>();
    const blankExamples: string[]=[];
    const malformedExamples: string[]=[];
    let malformedConfigurationCount=0;

    if(options.separator==='') {
        malformedConfigurationCount=1;
        addExample(malformedExamples, 'The configured path separator is blank.');
    }

    rows.forEach((row, rowIndex) => {
        const rowNumber=rowIndex+1;
        const id=normalizeHierarchyValue(row[options.idColumnIndex]);
        if(typeof id==='undefined') {
            malformedRows.add(rowIndex);
            addExample(malformedExamples, `Row ${ rowNumber }: the ID is blank.`);
        }
        else {
            idCounts.set(id, (idCounts.get(id)||0)+1);
        }

        const labels=options.levelColumnIndexes.map(columnIndex => normalizeHierarchyValue(row[columnIndex]));
        let lastPopulatedIndex=-1;
        for(let index=labels.length-1;index>=0;index--) {
            if(typeof labels[index]!=='undefined') {
                lastPopulatedIndex=index;
                break;
            }
        }

        if(lastPopulatedIndex===-1) {
            blankLabelRows.add(rowIndex);
            malformedRows.add(rowIndex);
            addExample(blankExamples, `Row ${ rowNumber }: every hierarchy label is blank.`);
            addExample(malformedExamples, `Row ${ rowNumber }: the hierarchy path is empty.`);
            return;
        }

        for(let index=0;index<=lastPopulatedIndex;index++) {
            if(typeof labels[index]==='undefined') {
                const fieldName=options.levelFieldNames?.[index]||`Level ${ index+1 }`;
                blankLabelRows.add(rowIndex);
                malformedRows.add(rowIndex);
                addExample(blankExamples, `Row ${ rowNumber }: ${ fieldName } is blank before a deeper level.`);
                addExample(malformedExamples, `Row ${ rowNumber }: a deeper value follows the blank ${ fieldName } field.`);
                break;
            }
        }

        if(options.separator!==''&&labels.some(label => label?.includes(options.separator))) {
            malformedRows.add(rowIndex);
            addExample(malformedExamples, `Row ${ rowNumber }: a label contains the configured “${ options.separator }” separator.`);
        }
    });

    const duplicateIds=Array.from(idCounts.entries()).filter(([, count]) => count>1);
    const checks=[
        createCheck(
            'duplicate-ids',
            duplicateIds.length,
            duplicateIds.slice(0, MAX_EXAMPLES).map(([id, count]) => `ID “${ id }” appears ${ count } times.`)
        ),
        createCheck('orphaned-children', 0, [], true),
        createCheck('circular-relationships', 0, [], true),
        createCheck('blank-labels', blankLabelRows.size, blankExamples),
        createCheck('malformed-paths', malformedRows.size+malformedConfigurationCount, malformedExamples)
    ];
    return makeResult(rows.length, checks);
}

/** Validate rows from a hierarchy stored as parent and child relationships. */
export function validateRecursiveHierarchy(
    rows: HierarchyCell[][],
    options: RecursiveHierarchyValidationOptions
): HierarchyValidationResult {
    const idCounts=new Map<string, number>();
    const knownIds=new Set<string>();
    const parentById=new Map<string, string|undefined>();
    const blankLabelRows=new Set<number>();
    const malformedRows=new Set<number>();
    const blankExamples: string[]=[];
    const malformedExamples: string[]=[];

    rows.forEach((row, rowIndex) => {
        const rowNumber=rowIndex+1;
        const id=normalizeHierarchyValue(row[options.idColumnIndex]);
        const parentId=normalizeParentId(row[options.parentIdColumnIndex]);
        const label=normalizeHierarchyValue(row[options.labelColumnIndex]);

        if(typeof id==='undefined') {
            malformedRows.add(rowIndex);
            addExample(malformedExamples, `Row ${ rowNumber }: the child ID is blank.`);
        }
        else {
            knownIds.add(id);
            idCounts.set(id, (idCounts.get(id)||0)+1);
            if(!parentById.has(id)) { parentById.set(id, parentId); }
        }

        if(typeof label==='undefined') {
            blankLabelRows.add(rowIndex);
            addExample(blankExamples, `Row ${ rowNumber }${ typeof id==='undefined'?'':` (ID “${ id }”)` }: the display label is blank.`);
        }
    });

    const duplicateIds=Array.from(idCounts.entries()).filter(([, count]) => count>1);
    const orphanedChildren=new Map<string, string>();
    parentById.forEach((parentId, id) => {
        if(typeof parentId!=='undefined'&&!knownIds.has(parentId)) {
            orphanedChildren.set(id, parentId);
        }
    });
    const cycles=findCircularRelationships(parentById, knownIds);
    const checks=[
        createCheck(
            'duplicate-ids',
            duplicateIds.length,
            duplicateIds.slice(0, MAX_EXAMPLES).map(([id, count]) => `ID “${ id }” appears ${ count } times.`)
        ),
        createCheck(
            'orphaned-children',
            orphanedChildren.size,
            Array.from(orphanedChildren.entries())
                .slice(0, MAX_EXAMPLES)
                .map(([id, parentId]) => `Child “${ id }” references missing parent “${ parentId }”.`)
        ),
        createCheck(
            'circular-relationships',
            cycles.length,
            cycles.slice(0, MAX_EXAMPLES).map(cycle => cycle.join(' → '))
        ),
        createCheck('blank-labels', blankLabelRows.size, blankExamples),
        createCheck('malformed-paths', malformedRows.size, malformedExamples)
    ];
    return makeResult(rows.length, checks);
}

function addExample(examples: string[], example: string): void {
    if(examples.length<MAX_EXAMPLES&&!examples.includes(example)) { examples.push(example); }
}

function createCheck(
    code: HierarchyValidationCode,
    issueCount: number,
    examples: string[],
    notApplicable=false
): HierarchyValidationCheck {
    const definition=CHECK_DEFINITIONS[code];
    const status: HierarchyValidationStatus=notApplicable?'not-applicable':issueCount>0?'failed':'passed';
    return {
        code,
        description: status==='failed'?definition.failedDescription(issueCount):
            status==='passed'?definition.passedDescription:'This check does not apply to the selected hierarchy format.',
        examples,
        issueCount,
        status,
        title: definition.title
    };
}

function findCircularRelationships(
    parentById: Map<string, string|undefined>,
    knownIds: ReadonlySet<string>
): string[][] {
    const completed=new Set<string>();
    const cycles: string[][]=[];

    knownIds.forEach(startId => {
        if(completed.has(startId)) { return; }
        const path: string[]=[];
        const pathIndexes=new Map<string, number>();
        let currentId: string|undefined=startId;
        while(typeof currentId!=='undefined'&&knownIds.has(currentId)&&!completed.has(currentId)) {
            const existingIndex=pathIndexes.get(currentId);
            if(typeof existingIndex==='number') {
                cycles.push(path.slice(existingIndex).concat(currentId));
                break;
            }
            pathIndexes.set(currentId, path.length);
            path.push(currentId);
            currentId=parentById.get(currentId);
        }
        path.forEach(id => completed.add(id));
    });
    return cycles;
}

function makeResult(rowsChecked: number, checks: HierarchyValidationCheck[]): HierarchyValidationResult {
    if(rowsChecked===0) {
        const malformedCheck=checks.find(check => check.code==='malformed-paths');
        if(malformedCheck) {
            malformedCheck.status='failed';
            malformedCheck.issueCount+=1;
            malformedCheck.description='No source rows were returned for validation.';
            malformedCheck.examples=['Confirm that the source worksheet contains visible, unfiltered hierarchy rows.'];
        }
    }
    return {
        checks,
        rowsChecked,
        valid: checks.every(check => check.status!=='failed')
    };
}

function normalizeParentId(cell: HierarchyCell): string|undefined {
    const parentId=normalizeHierarchyValue(cell);
    return parentId==='0'?undefined:parentId;
}
