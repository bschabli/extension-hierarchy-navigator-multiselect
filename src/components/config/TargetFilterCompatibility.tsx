import { useEffect, useMemo, useState } from 'react';
import { FilterTarget } from '../API/FilterTargets';
import { SelectionBehavior } from '../API/SelectionBehavior';
import { useTranslation } from '../localization/I18n';
import {
    NormalizedTreeNode,
    getAllSelectableFilterValues,
    normalizeHierarchyValue
} from '../extension/TreeModel';
import {
    buildHierarchyFilterValueRecords,
    resolveMappedFilterValues
} from '../extension/FilterTargetValues';
import { compareFilterValueSamples, FilterCompatibilityResult } from './FilterCompatibilityModel';

interface Props {
    previewTree?: NormalizedTreeNode[];
    selectionBehavior: SelectionBehavior;
    separator: string;
    target: FilterTarget;
}

type CompatibilityState={ status: 'idle'|'loading' }|{
    limited: boolean;
    result: FilterCompatibilityResult;
    status: 'ready';
}|{
    message: string;
    status: 'unavailable';
};

const SAMPLE_ROW_LIMIT=1000;

/** Show a non-blocking comparison between mapped source values and one target field. */
export function TargetFilterCompatibility(props: Props) {
    const {t}=useTranslation();
    const sourceValues=useMemo(() => {
        if(!props.previewTree?.length) { return []; }
        const selectableIds=getAllSelectableFilterValues(props.previewTree, props.selectionBehavior);
        const records=buildHierarchyFilterValueRecords(
            props.previewTree,
            selectableIds,
            props.separator
        );
        return resolveMappedFilterValues(props.target, records);
    }, [
        props.previewTree,
        props.selectionBehavior,
        props.separator,
        props.target.levelIndex,
        props.target.valueSource
    ]);
    const sourceSignature=JSON.stringify(sourceValues);
    const [state, setState]=useState<CompatibilityState>({ status: 'idle' });

    useEffect(() => {
        let cancelled=false;
        if(!props.previewTree?.length) {
            setState({ status: 'idle' });
            return () => { cancelled=true; };
        }
        if(sourceValues.length===0) {
            setState({
                message: t('The selected mapping does not produce a value for any selectable hierarchy item.'),
                status: 'unavailable'
            });
            return () => { cancelled=true; };
        }
        const dashboard=window.tableau.extensions.dashboardContent?.dashboard;
        const worksheet=dashboard?.worksheets.find(candidate => candidate.name===props.target.worksheetName);
        if(!worksheet) {
            setState({
                message: t('The target worksheet is not currently available in Tableau.'),
                status: 'unavailable'
            });
            return () => { cancelled=true; };
        }

        setState({ status: 'loading' });
        worksheet.getSummaryDataAsync({ ignoreSelection: true, maxRows: SAMPLE_ROW_LIMIT })
            .then(table => {
                if(cancelled) { return; }
                const column=table.columns.find(candidate => candidate.fieldName===props.target.fieldName);
                if(!column) {
                    setState({
                        message: t('This field can be filtered, but Tableau does not expose sample values for it in the worksheet summary data.'),
                        status: 'unavailable'
                    });
                    return;
                }
                const targetValues=new Set<string>();
                table.data.forEach(row => {
                    const value=normalizeHierarchyValue(row[column.index]);
                    if(typeof value==='string') { targetValues.add(value); }
                });
                setState({
                    limited: Boolean(table.isTotalRowCountLimited)||table.data.length<table.totalRowCount,
                    result: compareFilterValueSamples(sourceValues, Array.from(targetValues)),
                    status: 'ready'
                });
            })
            .catch(error => {
                if(cancelled) { return; }
                console.warn(
                    `Unable to preview filter compatibility for '${props.target.fieldName}' on `+
                    `'${props.target.worksheetName}'.`,
                    error
                );
                setState({
                    message: t('Tableau could not read a sample from this target field.'),
                    status: 'unavailable'
                });
            });
        return () => { cancelled=true; };
    }, [props.previewTree, props.target.fieldName, props.target.worksheetName, sourceSignature, t]);

    const visualStatus=state.status==='ready'&&state.result.matchPercent<100?'warning':state.status;
    return (
        <div className={`config-filter-compatibility config-filter-compatibility--${ visualStatus }`} aria-live='polite'>
            <strong>{t('Value compatibility')}</strong>
            {state.status==='idle'&&
                <span>{t('Complete source validation to compare these values with the target field.')}</span>
            }
            {state.status==='loading'&&<span>{t('Comparing source and target values…')}</span>}
            {state.status==='unavailable'&&<span>{state.message}</span>}
            {state.status==='ready'&&
                <>
                    <span>{t('{matchCount} of {sourceCount} mapped source values appear in the target sample ({percent}%).', {
                        matchCount: state.result.matchCount,
                        sourceCount: state.result.sourceCount,
                        percent: state.result.matchPercent
                    })}</span>
                    {state.result.missingExamples.length>0&&
                        <small>{t('Examples not found: {values}', {
                            values: state.result.missingExamples.join(', ')
                        })}</small>
                    }
                    {state.limited&&<small>{t('Tableau returned a limited sample, so additional matches may exist.')}</small>}
                </>
            }
        </div>
    );
}
