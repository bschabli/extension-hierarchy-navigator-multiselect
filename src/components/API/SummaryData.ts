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
