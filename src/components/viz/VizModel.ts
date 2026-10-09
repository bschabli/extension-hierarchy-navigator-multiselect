import { Column, VisualSpecification } from '@tableau/extensions-api-types';
import { SummaryDataset } from '../API/SummaryData';
import { defaultSelectedProps, HierarchyProps, HierType } from '../API/Interfaces';
import { isSelectionBehavior, SelectionBehavior } from '../API/SelectionBehavior';
import { getHierarchyValue, normalizeHierarchyValue } from '../extension/TreeModel';
import { validateFlatHierarchy, validateRecursiveHierarchy } from '../API/HierarchyValidation';

export interface VizPreferences {
    version: 1;
    compact: boolean;
    selectionBehavior: SelectionBehavior;
}

export const defaultVizPreferences: VizPreferences={
    version: 1, compact: false, selectionBehavior: SelectionBehavior.TERMINAL
};

export function parseVizPreferences(json?: string): VizPreferences {
    if(!json) { return { ...defaultVizPreferences }; }
    const value=JSON.parse(json) as Partial<VizPreferences>;
    if(!value||value.version!==1||
        typeof value.compact!=='boolean'||!isSelectionBehavior(value.selectionBehavior)) {
        throw new Error('Unsupported navigator settings.');
    }
    return { version: 1, compact: value.compact, selectionBehavior: value.selectionBehavior };
}

export interface VizBinding {
    data: HierarchyProps;
    dataset: SummaryDataset;
    idColumn: Column;
    keyColumnIndex: number;
    rawIds: Map<string, unknown>;
    warnings: string[];
}

/** Resolve encodings by field ID, including localized aggregate names. */
export function bindVizData(
    spec: VisualSpecification,
    source: SummaryDataset,
    worksheetName: string
): VizBinding {
    if(source.limited||source.rows.length<source.totalRowCount) {
        throw new Error('Tableau returned an incomplete hierarchy. Reduce the worksheet data and retry.');
    }
    const encodings=spec.marksSpecifications[spec.activeMarksSpecificationIndex]?.encodings||[];
    const fields=(id: string): Column[] => encodings.filter(encoding => encoding.id===id).map(encoding => {
        const column=source.columns.find(candidate => candidate.fieldId===encoding.field.fieldId);
        if(!column) { throw new Error(`Missing encoded field: ${encoding.field.name}`); }
        return column;
    });
    const levels=fields('hierarchy');
    const ids=fields('id');
    const parents=fields('parent');
    if(ids.length!==1||!levels.length) {
        throw new Error('Add hierarchy levels (or one recursive label) to Hierarchy and a unique key to Node ID.');
    }
    if(parents.length>1||(parents.length===1&&levels.length!==1)) {
        throw new Error('Recursive hierarchies need one label on Hierarchy and one field on Parent ID.');
    }
    const idColumn=ids[0];
    const type=parents.length?HierType.RECURSIVE:HierType.FLAT;
    // Keep a separate canonical key column: a single Tableau field can be used
    // as both a label and an ID, and its display alias must remain intact.
    const rawIds=new Map<string, unknown>();
    const columns=source.columns.slice();
    const addKeyColumn=(suffix: string, field: Column): Column => {
        let fieldName=`__hierarchy_viz_${suffix}_${field.fieldId}__`;
        while(columns.some(column => column.fieldName===fieldName)) { fieldName+='_'; }
        const column={ ...field, fieldName, fieldId: fieldName,
            index: Math.max(-1,...columns.map(candidate => candidate.index))+1 };
        columns.push(column);
        return column;
    };
    const keyColumn=addKeyColumn('id', idColumn);
    const parentKeyColumn=parents.length?addKeyColumn('parent', parents[0]):undefined;
    const canonicalCell=(cell: SummaryDataset['rows'][number][number]) => {
        const raw=getHierarchyValue(cell);
        return { ...cell, formattedValue: raw===null||raw===undefined?'':String(raw) };
    };
    const rows=source.rows.map(row => {
        const copy=row.slice();
        copy[keyColumn.index]=canonicalCell(row[idColumn.index]);
        const key=normalizeHierarchyValue(copy[keyColumn.index]);
        if(key!==undefined) { rawIds.set(key, getHierarchyValue(row[idColumn.index])); }
        if(parentKeyColumn) { copy[parentKeyColumn.index]=canonicalCell(row[parents[0].index]); }
        return copy;
    });
    const validation=type===HierType.FLAT?validateFlatHierarchy(rows, {
        idColumnIndex: keyColumn.index, levelColumnIndexes: levels.map(column => column.index), separator: '|'
    }):validateRecursiveHierarchy(rows, {
        idColumnIndex: keyColumn.index, parentIdColumnIndex: parentKeyColumn!.index, labelColumnIndex: levels[0].index
    });
    if(rows.some(row => normalizeHierarchyValue(row[keyColumn.index])===undefined)) {
        throw new Error('Node IDs must not be blank.');
    }
    const failures=rows.length?validation.checks.filter(check => check.status==='failed'):[];
    const fatal=failures.filter(check => check.code==='duplicate-ids'||check.code==='circular-relationships'||
        (type===HierType.RECURSIVE&&check.code==='blank-labels'));
    if(fatal.length) { throw new Error(fatal.map(check => check.description).join(' ')); }
    return {
        idColumn, keyColumnIndex: keyColumn.index, rawIds,
        warnings: failures.map(check => check.description),
        dataset: { ...source, columns, rows },
        data: {
            ...defaultSelectedProps,
            configComplete: true,
            type,
            options: { ...defaultSelectedProps.options, titleEnabled: false, bgColor: '#ffffff',
                fontColor: '#172b3a', highlightColor: '#e7f2f6', fontFamily: 'system-ui, sans-serif', fontSize: '13px' },
            worksheet: { ...defaultSelectedProps.worksheet, name: worksheetName,
                childId: keyColumn.fieldName, parentId: parentKeyColumn?.fieldName||'',
                childLabel: levels[0].fieldName, fields: levels.map(column => column.fieldName) }
        }
    };
}
