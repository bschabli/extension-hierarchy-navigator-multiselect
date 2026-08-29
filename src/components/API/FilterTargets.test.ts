import {
    FilterTarget,
    FilterableWorksheet,
    findNextFilterTargetWorksheet,
    replaceFilterTargetField,
    resolveFilterTargets,
    resolveFilterTargetsExcludingWorksheet,
    shouldUpdateFilterTargets,
    syncLegacyFilterTarget,
    updateFilterTargets
} from './FilterTargets';

function assert(condition: boolean, message: string): void {
    if(!condition) { throw new Error(message); }
}

async function run(): Promise<void> {
    const migrated=resolveFilterTargets({
        targetName: 'Sales',
        targetFilter: 'Product Path'
    });
    assert(migrated.length===1, 'Legacy settings should migrate to one filter target.');
    assert(migrated[0].worksheetName==='Sales', 'The legacy worksheet should be preserved.');
    assert(migrated[0].fieldName==='Product Path', 'The legacy field should be preserved.');

    const normalized=resolveFilterTargets({
        filterTargets: [
            { worksheetName: 'Sales', fieldName: 'Product Path' },
            { worksheetName: 'Profit', fieldName: 'Product ID' },
            { worksheetName: 'Sales', fieldName: 'Product Path' },
            { worksheetName: '', fieldName: 'Ignored' }
        ]
    });
    assert(normalized.length===2, 'Duplicate and incomplete filter targets should be removed.');
    const malformed=resolveFilterTargets({
        filterTargets: ['invalid', { worksheetName: 'Sales' }, null] as unknown as FilterTarget[]
    });
    assert(malformed.length===0, 'Malformed persisted filter targets should be ignored safely.');

    const externalTargets=resolveFilterTargetsExcludingWorksheet({
        filterTargets: [
            { worksheetName: 'Hierarchy Source', fieldName: 'Product Path' },
            { worksheetName: 'Sales', fieldName: 'Product Path' },
            { worksheetName: 'Profit', fieldName: 'Product ID' }
        ]
    }, 'Hierarchy Source');
    assert(externalTargets.length===2, 'The hierarchy source worksheet must be excluded from filter targets.');
    assert(
        externalTargets.every(target => target.worksheetName!=='Hierarchy Source'),
        'No resolved external target may point back to the hierarchy source worksheet.'
    );

    const settings={
        filter: 'Old Field',
        filterTargets: normalized,
        targetFilter: 'Old Field',
        targetName: 'Old Sheet'
    };
    syncLegacyFilterTarget(settings);
    assert(settings.targetName==='Sales', 'The first target should mirror to the legacy worksheet.');
    assert(settings.targetFilter==='Product Path', 'The first target should mirror to the legacy target field.');
    assert(settings.filter==='Product Path', 'The first target should mirror to the oldest filter field.');

    syncLegacyFilterTarget(settings, []);
    assert(settings.filterTargets.length===0, 'Explicitly clearing targets should not recreate the legacy target.');
    assert(settings.targetName==='', 'Clearing targets should clear the legacy worksheet.');
    assert(settings.targetFilter==='', 'Clearing targets should clear the legacy target field.');

    const nextWorksheet=findNextFilterTargetWorksheet(
        ['Empty sheet', 'Sales', 'Profit'],
        [{ worksheetName: 'Sales', fieldName: 'Product Path' }],
        worksheetName => worksheetName!=='Empty sheet'
    );
    assert(nextWorksheet==='Profit', 'Adding a target should skip empty and already configured worksheets.');

    const nextExternalWorksheet=findNextFilterTargetWorksheet(
        ['Hierarchy Source', 'Sales'],
        [],
        worksheetName => worksheetName!=='Hierarchy Source'
    );
    assert(nextExternalWorksheet==='Sales', 'Adding a target should skip the hierarchy source worksheet.');

    const renamedTargets=replaceFilterTargetField(
        [
            { worksheetName: 'Sales', fieldName: 'Old ID' },
            { worksheetName: 'Profit', fieldName: 'Old ID' },
            { worksheetName: 'Inventory', fieldName: 'SKU' }
        ],
        'Old ID',
        'New ID'
    );
    assert(
        renamedTargets[0].fieldName==='New ID'&&renamedTargets[1].fieldName==='New ID',
        'Child ID changes should propagate by field match across every target worksheet.'
    );
    assert(renamedTargets[2].fieldName==='SKU', 'Unrelated target fields should remain unchanged.');
    assert(
        !shouldUpdateFilterTargets(false, normalized),
        'Disabled filtering must never apply or clear target filters.'
    );
    assert(shouldUpdateFilterTargets(true, normalized), 'Enabled filtering should update valid targets.');

    const calls: string[]=[];
    const worksheets: FilterableWorksheet[]=[
        {
            name: 'Sales',
            applyFilterAsync: async (fieldName, values) => { calls.push(`apply:Sales:${fieldName}:${values.join(',')}`); },
            clearFilterAsync: async fieldName => { calls.push(`clear:Sales:${fieldName}`); }
        },
        {
            name: 'Profit',
            applyFilterAsync: async (fieldName, values) => { calls.push(`apply:Profit:${fieldName}:${values.join(',')}`); },
            clearFilterAsync: async fieldName => { calls.push(`clear:Profit:${fieldName}`); }
        }
    ];
    const applied=await updateFilterTargets(normalized, worksheets, ['A', 'B'], 'replace');
    assert(applied.length===2, 'Every valid worksheet target should receive the selection.');
    assert(calls.includes('apply:Sales:Product Path:A,B'), 'The Sales target should receive all selected values.');
    assert(calls.includes('apply:Profit:Product ID:A,B'), 'The Profit target should receive all selected values.');

    await updateFilterTargets(normalized, worksheets, [], 'replace');
    assert(calls.includes('clear:Sales:Product Path'), 'Reset should clear the Sales target field.');
    assert(calls.includes('clear:Profit:Product ID'), 'Reset should clear the Profit target field.');

    const resilientCalls: string[]=[];
    const errors: string[]=[];
    const partiallyFailingWorksheets: FilterableWorksheet[]=[
        {
            name: 'Sales',
            applyFilterAsync: async () => { throw new Error('Sales unavailable'); },
            clearFilterAsync: async () => undefined
        },
        {
            name: 'Profit',
            applyFilterAsync: async () => { resilientCalls.push('Profit updated'); },
            clearFilterAsync: async () => undefined
        }
    ];
    const partiallyApplied=await updateFilterTargets(
        normalized,
        partiallyFailingWorksheets,
        ['A'],
        'replace',
        target => errors.push(target.worksheetName)
    );
    assert(errors.join(',')==='Sales', 'A failed target should be reported.');
    assert(resilientCalls.includes('Profit updated'), 'A failed target should not block later worksheets.');
    assert(partiallyApplied.length===1&&partiallyApplied[0].worksheetName==='Profit', 'Only successful targets should be tracked as applied.');

    console.log('Filter target migration tests passed.');
}

run().catch(error => {
    console.error(error);
    throw error;
});
