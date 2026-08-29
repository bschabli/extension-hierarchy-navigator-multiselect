export type FilterValueSource='id'|'label'|'path'|'level';

export interface FilterTarget {
    worksheetName: string;
    fieldName: string;
    valueSource?: FilterValueSource;
    levelIndex?: number;
}

export interface FilterTargetSettings {
    filter?: string;
    filterTargets?: FilterTarget[];
    targetFilter?: string;
    targetName?: string;
}

export interface FilterableWorksheet {
    name: string;
    applyFilterAsync: (fieldName: string, values: any[], updateType: any, options: any) => Promise<any>;
    clearFilterAsync: (fieldName: string) => Promise<any>;
}

/** Return a supported target value mapping, falling back to the legacy ID behavior. */
export function resolveFilterValueSource(value: unknown): FilterValueSource {
    return value==='label'||value==='path'||value==='level'?value:'id';
}

/** Return a safe zero-based hierarchy level for level-based target mappings. */
export function resolveFilterTargetLevel(value: unknown): number {
    return typeof value==='number'&&Number.isInteger(value)&&value>=0?value:0;
}

/** Return valid, unique targets with a legacy single-target fallback. */
export function resolveFilterTargets(settings: FilterTargetSettings): FilterTarget[] {
    const configured=Array.isArray(settings.filterTargets)?settings.filterTargets:[];
    const candidates: unknown[]=configured.length?configured:[{
        worksheetName: settings.targetName||'',
        fieldName: settings.targetFilter||settings.filter||''
    }];
    const seen=new Set<string>();

    return candidates.reduce<FilterTarget[]>((targets, target) => {
        if(typeof target!=='object'||target===null) { return targets; }
        const candidate=target as Partial<FilterTarget>;
        if(typeof candidate.worksheetName!=='string'||candidate.worksheetName===''||
            typeof candidate.fieldName!=='string'||candidate.fieldName==='') { return targets; }
        const key=`${candidate.worksheetName}\u0000${candidate.fieldName}`;
        if(seen.has(key)) { return targets; }
        seen.add(key);
        const valueSource=resolveFilterValueSource(candidate.valueSource);
        targets.push({
            worksheetName: candidate.worksheetName,
            fieldName: candidate.fieldName,
            valueSource,
            ...(valueSource==='level'?{ levelIndex: resolveFilterTargetLevel(candidate.levelIndex) }: {})
        });
        return targets;
    }, []);
}

/** Resolve targets while excluding a worksheet that must not be filtered. */
export function resolveFilterTargetsExcludingWorksheet(
    settings: FilterTargetSettings,
    excludedWorksheetName: string
): FilterTarget[] {
    return resolveFilterTargets(settings).filter(target => target.worksheetName!==excludedWorksheetName);
}

/** Store normalized targets and mirror the first one into legacy settings. */
export function syncLegacyFilterTarget(settings: FilterTargetSettings, targets?: FilterTarget[]): void {
    const normalized=typeof targets==='undefined'?
        resolveFilterTargets(settings):
        resolveFilterTargets({ filterTargets: targets });
    settings.filterTargets=normalized;
    settings.targetName=normalized[0]?.worksheetName||'';
    settings.targetFilter=normalized[0]?.fieldName||'';
    settings.filter=normalized[0]?.fieldName||'';
}

/** Return the first unused worksheet that exposes at least one filterable field. */
export function findNextFilterTargetWorksheet(
    worksheetNames: readonly string[],
    configuredTargets: readonly FilterTarget[],
    hasFilterableFields: (worksheetName: string) => boolean
): string {
    const usedWorksheetNames=new Set(configuredTargets.map(target => target.worksheetName));
    return worksheetNames.find(
        worksheetName => !usedWorksheetNames.has(worksheetName)&&hasFilterableFields(worksheetName)
    )||'';
}

/** Replace a matching field in every configured worksheet target. */
export function replaceFilterTargetField(
    targets: readonly FilterTarget[],
    previousFieldName: string,
    nextFieldName: string
): FilterTarget[] {
    return targets.map(target => target.fieldName===previousFieldName?
        { ...target, fieldName: nextFieldName }:
        target
    );
}

/** Return whether selection changes may mutate configured Tableau filters. */
export function shouldUpdateFilterTargets(
    filterEnabled: boolean,
    targets: readonly FilterTarget[]
): boolean {
    return filterEnabled&&resolveFilterTargets({ filterTargets: Array.from(targets) }).length>0;
}

/** Apply or clear every target independently and return successfully applied targets. */
export async function updateFilterTargets(
    targets: FilterTarget[],
    worksheets: FilterableWorksheet[],
    selectedValues: any[],
    filterUpdateType: any,
    onError?: (target: FilterTarget, error: any) => void
): Promise<FilterTarget[]> {
    const applied: FilterTarget[]=[];
    for(const target of resolveFilterTargets({ filterTargets: targets })) {
        const worksheet=worksheets.find(candidate => candidate.name===target.worksheetName);
        if(!worksheet) {
            if(onError) { onError(target, new Error(`Worksheet '${target.worksheetName}' was not found.`)); }
            continue;
        }
        try {
            if(selectedValues.length) {
                await worksheet.applyFilterAsync(
                    target.fieldName,
                    selectedValues,
                    filterUpdateType,
                    { isExcludeMode: false }
                );
                applied.push(target);
            }
            else {
                await worksheet.clearFilterAsync(target.fieldName);
            }
        }
        catch(error) {
            if(onError) { onError(target, error); }
        }
    }
    return applied;
}
