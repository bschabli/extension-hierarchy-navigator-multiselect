import {
    Column,
    DataTable,
    DataTableReader,
    DataValue,
    GetSummaryDataOptions
} from '@tableau/extensions-api-types';

export interface SummaryDataset {
    columns: Column[];
    limited: boolean;
    rows: DataValue[][];
    totalRowCount: number;
}

export interface SummaryDataWorksheet {
    getSummaryColumnsInfoAsync?: () => Promise<Column[]>;
    getSummaryDataAsync: (options?: GetSummaryDataOptions) => Promise<DataTable>;
    getSummaryDataReaderAsync?: (
        pageRowCount?: number,
        options?: GetSummaryDataOptions
    ) => Promise<DataTableReader>;
}

const DEFAULT_PAGE_ROW_COUNT=10000;

/** Resolve configured Tableau field names to summary-data column indexes. */
export function resolveSummaryColumnIndexes(
    columns: readonly Column[],
    fieldNames: readonly string[]
): number[] {
    const columnIndexes=new Map<string, number>();
    columns.forEach(column => columnIndexes.set(column.fieldName, column.index));
    const missingFields=Array.from(new Set(
        fieldNames.filter(fieldName => typeof columnIndexes.get(fieldName)!=='number')
    ));
    if(missingFields.length>0) {
        const quotedFields=missingFields.map(fieldName => `“${ fieldName }”`).join(', ');
        throw new Error(missingFields.length===1?
            `Mapped field ${ quotedFields } is not present in the source worksheet data.`:
            `Mapped fields ${ quotedFields } are not present in the source worksheet data.`
        );
    }
    return fieldNames.map(fieldName => columnIndexes.get(fieldName)!);
}

/** Load summary column metadata without fetching rows when the host supports it. */
export async function loadSummaryColumns(
    worksheet: SummaryDataWorksheet,
    options: GetSummaryDataOptions={ ignoreSelection: true }
): Promise<Column[]> {
    if(typeof worksheet.getSummaryColumnsInfoAsync==='function') {
        return worksheet.getSummaryColumnsInfoAsync();
    }
    const table=await worksheet.getSummaryDataAsync({ ...options, maxRows: 1 });
    return table.columns;
}

/** Load all available summary rows with the current paged API and a legacy fallback. */
export async function loadSummaryDataset(
    worksheet: SummaryDataWorksheet,
    options: GetSummaryDataOptions={ ignoreSelection: true },
    pageRowCount=DEFAULT_PAGE_ROW_COUNT
): Promise<SummaryDataset> {
    const readerMethod=worksheet.getSummaryDataReaderAsync;
    if(typeof readerMethod==='function') {
        try {
            const reader=await readerMethod.call(worksheet, pageRowCount, options);
            const rows: DataValue[][]=[];
            let columns: Column[]=[];
            try {
                for(let pageIndex=0;pageIndex<reader.pageCount;pageIndex++) {
                    const page=await reader.getPageAsync(pageIndex);
                    if(columns.length===0) { columns=page.columns; }
                    rows.push(...page.data);
                }
                if(columns.length===0) { columns=await loadSummaryColumns(worksheet, options); }
                return {
                    columns,
                    limited: rows.length<reader.totalRowCount,
                    rows,
                    totalRowCount: reader.totalRowCount
                };
            }
            finally {
                try { await reader.releaseAsync(); }
                catch(error) { console.warn('Unable to release the Tableau summary data reader.', error); }
            }
        }
        catch(error) {
            console.warn('Paged Tableau summary data was unavailable; using the compatibility API.', error);
        }
    }

    const table=await worksheet.getSummaryDataAsync({ ...options, maxRows: 0 });
    return {
        columns: table.columns,
        limited: Boolean(table.isTotalRowCountLimited)||table.data.length<table.totalRowCount,
        rows: table.data,
        totalRowCount: table.totalRowCount
    };
}
