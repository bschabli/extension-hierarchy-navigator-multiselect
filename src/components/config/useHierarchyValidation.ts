import {
    Column,
    DataTable,
    DataTableReader,
    DataValue,
    GetSummaryDataOptions,
    Worksheet
} from '@tableau/extensions-api-types';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    HierarchyValidationResult,
    validateFlatHierarchy,
    validateRecursiveHierarchy
} from '../API/HierarchyValidation';
import { HierarchyProps, HierType } from '../API/Interfaces';
import {
    NormalizedTreeNode,
    buildFlatTree,
    buildRecursiveTree
} from '../extension/TreeModel';

export type HierarchyValidationRunStatus='idle'|'loading'|'complete'|'error';

export interface HierarchyValidationState {
    errorMessage?: string;
    previewTree?: NormalizedTreeNode[];
    result?: HierarchyValidationResult;
    status: HierarchyValidationRunStatus;
}

interface InternalHierarchyValidationState extends HierarchyValidationState {
    mappingSignature?: string;
}

interface SummaryDataset {
    columns: Column[];
    limited: boolean;
    rows: DataValue[][];
    totalRowCount: number;
}

interface ReaderCapableWorksheet {
    getSummaryDataReaderAsync?: (
        pageRowCount?: number,
        options?: GetSummaryDataOptions
    ) => Promise<DataTableReader>;
}

const PAGE_ROW_COUNT=10000;

/** Load and validate the configured source worksheet whenever its mapping changes. */
export function useHierarchyValidation(
    data: HierarchyProps,
    sourceComplete: boolean
): { retry: () => void, state: HierarchyValidationState } {
    const [refreshKey, setRefreshKey]=useState(0);
    const [state, setState]=useState<InternalHierarchyValidationState>({ status: 'idle' });
    const validationQueue=useRef<Promise<void>>(Promise.resolve());
    const mappingSignature=JSON.stringify({
        childId: data.worksheet.childId,
        childLabel: data.worksheet.childLabel,
        fields: data.worksheet.fields,
        name: data.worksheet.name,
        parentId: data.worksheet.parentId,
        separator: data.separator,
        type: data.type
    });

    useEffect(() => {
        let cancelled=false;
        if(!sourceComplete) {
            setState({ status: 'idle' });
            return () => { cancelled=true; };
        }

        setState({ mappingSignature, status: 'loading' });
        async function runValidation(): Promise<void> {
            if(cancelled) { return; }
            try {
                const worksheet=window.tableau.extensions.dashboardContent!.dashboard.worksheets.find(
                    candidate => candidate.name===data.worksheet.name
                );
                if(typeof worksheet==='undefined') {
                    throw new Error(`Worksheet “${ data.worksheet.name }” is no longer available.`);
                }
                const dataset=await loadSummaryDataset(worksheet);
                if(dataset.limited||dataset.rows.length<dataset.totalRowCount) {
                    throw new Error(
                        `Tableau returned ${ dataset.rows.length } of ${ dataset.totalRowCount } rows. `+
                        'Validation must inspect the complete source worksheet.'
                    );
                }
                const columnIndexes=new Map<string, number>();
                dataset.columns.forEach(column => columnIndexes.set(column.fieldName, column.index));
                const getColumnIndex=(fieldName: string): number => {
                    const index=columnIndexes.get(fieldName);
                    if(typeof index!=='number') {
                        throw new Error(`Mapped field “${ fieldName }” is not present in the source worksheet data.`);
                    }
                    return index;
                };

                let previewTree: NormalizedTreeNode[]|undefined;
                let result: HierarchyValidationResult;
                if(data.type===HierType.FLAT) {
                    const idColumnIndex=getColumnIndex(data.worksheet.childId);
                    const levelColumnIndexes=data.worksheet.fields.map(getColumnIndex);
                    result=validateFlatHierarchy(dataset.rows, {
                        idColumnIndex,
                        levelColumnIndexes,
                        levelFieldNames: data.worksheet.fields,
                        separator: data.separator
                    });
                    if(result.valid) {
                        previewTree=buildFlatTree(
                            dataset.rows,
                            levelColumnIndexes,
                            idColumnIndex,
                            data.separator
                        );
                    }
                }
                else {
                    const idColumnIndex=getColumnIndex(data.worksheet.childId);
                    const labelColumnIndex=getColumnIndex(data.worksheet.childLabel);
                    const parentIdColumnIndex=getColumnIndex(data.worksheet.parentId);
                    result=validateRecursiveHierarchy(dataset.rows, {
                        idColumnIndex,
                        labelColumnIndex,
                        parentIdColumnIndex
                    });
                    if(result.valid) {
                        previewTree=buildRecursiveTree(
                            dataset.rows,
                            parentIdColumnIndex,
                            idColumnIndex,
                            labelColumnIndex
                        );
                    }
                }
                if(!cancelled) {
                    setState({ mappingSignature, previewTree, result, status: 'complete' });
                }
            }
            catch(error) {
                if(!cancelled) {
                    const message=error instanceof Error?error.message:String(error);
                    setState({ errorMessage: message, mappingSignature, status: 'error' });
                }
            }
        }

        validationQueue.current=validationQueue.current.then(runValidation, runValidation);
        return () => { cancelled=true; };
    }, [mappingSignature, refreshKey, sourceComplete]);

    const retry=useCallback(() => {
        setState({ mappingSignature, status: 'loading' });
        setRefreshKey(current => current+1);
    }, [mappingSignature]);
    const effectiveState: HierarchyValidationState=state.mappingSignature===mappingSignature?
        state:{ status: sourceComplete?'loading':'idle' };
    return { retry, state: effectiveState };
}

async function loadSummaryDataset(worksheet: Worksheet): Promise<SummaryDataset> {
    const readerMethod=(worksheet as unknown as ReaderCapableWorksheet).getSummaryDataReaderAsync;
    if(typeof readerMethod==='function') {
        try {
            const reader=await readerMethod.call(worksheet, PAGE_ROW_COUNT, { ignoreSelection: true });
            const rows: DataValue[][]=[];
            let columns: Column[]=[];
            try {
                for(let pageIndex=0;pageIndex<reader.pageCount;pageIndex++) {
                    const page=await reader.getPageAsync(pageIndex);
                    if(columns.length===0) { columns=page.columns; }
                    rows.push(...page.data);
                }
                if(columns.length===0) { columns=await worksheet.getSummaryColumnsInfoAsync(); }
                return {
                    columns,
                    limited: rows.length<reader.totalRowCount,
                    rows,
                    totalRowCount: reader.totalRowCount
                };
            }
            finally {
                try { await reader.releaseAsync(); }
                catch(error) { console.warn('Unable to release the Tableau validation data reader.', error); }
            }
        }
        catch(error) {
            console.warn('Paged Tableau data validation was unavailable; using the compatibility API.', error);
        }
    }

    const table: DataTable=await worksheet.getSummaryDataAsync({ ignoreSelection: true, maxRows: 0 });
    return {
        columns: table.columns,
        limited: Boolean(table.isTotalRowCountLimited),
        rows: table.data,
        totalRowCount: table.totalRowCount
    };
}
