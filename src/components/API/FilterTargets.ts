export interface FilterTarget {
    worksheetName: string;
    fieldName: string;
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

/** Return valid, unique targets with a legacy single-target fallback. */
export function resolveFilterTargets(settings: FilterTargetSettings): FilterTarget[] {
    const configured=Array.isArray(settings.filterTargets)?settings.filterTargets:[];
    const candidates=configured.length?configured:[{
        worksheetName: settings.targetName||'',
        fieldName: settings.targetFilter||settings.filter||''
    }];
    const seen=new Set<string>();

    return candidates.filter(target => {
        if(!target||target.worksheetName===''||target.fieldName==='') { return false; }
        const key=`${target.worksheetName}\u0000${target.fieldName}`;
        if(seen.has(key)) { return false; }
        seen.add(key);
        return true;
    });
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
