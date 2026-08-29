import { Column, DataTable, DataValue } from '@tableau/extensions-api-types';
import {
    SummaryDataWorksheet,
    loadSummaryColumns,
    loadSummaryDataset,
    resolveSummaryColumnIndexes
} from './SummaryData';

function assert(condition: boolean, message: string): void {
    if(!condition) { throw new Error(message); }
}

async function run(): Promise<void> {
    const columns=[{ fieldName: 'ID', index: 0 }] as Column[];
    const mappedColumns=[
        { fieldName: 'Region', index: 3 },
        { fieldName: 'ID', index: 7 }
    ] as Column[];
    const resolvedIndexes=resolveSummaryColumnIndexes(mappedColumns, ['Region', 'ID']);
    assert(resolvedIndexes.join(',')==='3,7', 'Mapped fields should resolve in the requested order.');
    let missingFieldMessage='';
    try {
        resolveSummaryColumnIndexes(mappedColumns, ['Missing level', 'Missing ID']);
    }
    catch(error) {
        missingFieldMessage=error instanceof Error?error.message:String(error);
    }
    assert(
        missingFieldMessage.includes('Missing level')&&missingFieldMessage.includes('Missing ID'),
        'Missing source fields should produce a descriptive mapping error.'
    );
    const firstRow=[[{ value: 'A' }]] as DataValue[][];
    const secondRow=[[{ value: 'B' }]] as DataValue[][];
    let released=false;
    let compatibilityCalls=0;
    const readerWorksheet: SummaryDataWorksheet={
        getSummaryColumnsInfoAsync: async () => columns,
        getSummaryDataAsync: async () => {
            compatibilityCalls+=1;
            return {} as DataTable;
        },
        getSummaryDataReaderAsync: async () => ({
            getAllPagesAsync: async () => ({} as DataTable),
            getPageAsync: async pageIndex => ({
                columns,
                data: pageIndex===0?firstRow:secondRow
            } as DataTable),
            pageCount: 2,
            releaseAsync: async () => { released=true; },
            totalRowCount: 2
        })
    };
    const readerDataset=await loadSummaryDataset(readerWorksheet);
    assert(readerDataset.rows.length===2, 'The paged reader should combine every summary-data page.');
    assert(readerDataset.columns===columns, 'The paged reader should preserve Tableau column metadata.');
    assert(!readerDataset.limited, 'A complete paged result should not be marked as limited.');
    assert(released, 'The paged reader must always be released after use.');
    assert(compatibilityCalls===0, 'The deprecated compatibility API should not run when paging succeeds.');

    let fallbackOptions: Record<string, unknown>|undefined;
    const fallbackTable={
        columns,
        data: firstRow,
        isTotalRowCountLimited: false,
        totalRowCount: 1
    } as DataTable;
    const legacyWorksheet: SummaryDataWorksheet={
        getSummaryColumnsInfoAsync: async () => columns,
        getSummaryDataAsync: async options => {
            fallbackOptions=options as Record<string, unknown>;
            return fallbackTable;
        }
    };
    const fallbackDataset=await loadSummaryDataset(legacyWorksheet);
    assert(fallbackDataset.rows.length===1, 'Older Tableau versions should use the compatibility API.');
    assert(fallbackOptions?.ignoreSelection===true, 'Summary loading should ignore current mark selection.');
    assert(fallbackOptions?.maxRows===0, 'The compatibility API should request all available rows.');

    let columnFallbackOptions: Record<string, unknown>|undefined;
    const legacyColumnWorksheet: SummaryDataWorksheet={
        getSummaryDataAsync: async options => {
            columnFallbackOptions=options as Record<string, unknown>;
            return fallbackTable;
        }
    };
    const fallbackColumns=await loadSummaryColumns(legacyColumnWorksheet);
    assert(fallbackColumns===columns, 'Older Tableau versions should read columns from summary data.');
    assert(columnFallbackOptions?.maxRows===1, 'The column compatibility path should request only one row.');

    console.log('Summary data reader tests passed.');
}

run().catch(error => {
    console.error(error);
    throw error;
});
