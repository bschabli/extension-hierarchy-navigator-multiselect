import { useCallback, useEffect, useRef, useState } from 'react';
import {
    HierarchyValidationResult,
    validateFlatHierarchy,
    validateRecursiveHierarchy
} from '../API/HierarchyValidation';
import { HierarchyProps, HierType } from '../API/Interfaces';
import { loadSummaryDataset, resolveSummaryColumnIndexes } from '../API/SummaryData';
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
                let previewTree: NormalizedTreeNode[]|undefined;
                let result: HierarchyValidationResult;
                if(data.type===HierType.FLAT) {
                    const columnIndexes=resolveSummaryColumnIndexes(
                        dataset.columns,
                        data.worksheet.fields.concat(data.worksheet.childId)
                    );
                    const idColumnIndex=columnIndexes[columnIndexes.length-1];
                    const levelColumnIndexes=columnIndexes.slice(0, -1);
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
                    const [parentIdColumnIndex, idColumnIndex, labelColumnIndex]=
                        resolveSummaryColumnIndexes(dataset.columns, [
                            data.worksheet.parentId,
                            data.worksheet.childId,
                            data.worksheet.childLabel
                        ]);
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
