import type { CSSProperties } from 'react';

export interface ParameterSelection {
    childId: string;
    childLabel: string;
}

/** Update one parameter mapping and swap the other mapping when it conflicts. */
export function updateParameterSelection(
    selection: ParameterSelection,
    target: 'childId'|'childLabel',
    value: string
): ParameterSelection {
    if(target==='childId') {
        return {
            childId: value,
            childLabel: selection.childLabel===value?selection.childId:selection.childLabel
        };
    }
    return {
        childId: selection.childId===value?selection.childLabel:selection.childId,
        childLabel: value
    };
}

/** Parse a JSON object whose values are safe to pass to React's style prop. */
export function parseItemCss(value: string): CSSProperties {
    const parsed: unknown=JSON.parse(value);
    if(!isItemCss(parsed)) {
        throw new Error('Item CSS must be a JSON object containing only string or number values.');
    }
    return parsed;
}

/** Return valid item CSS or a known-safe fallback for malformed saved settings. */
export function normalizeItemCss(value: unknown, fallback: CSSProperties): CSSProperties {
    return isItemCss(value)?value:fallback;
}

/** Keep the dashboard-listener delay finite and within the range exposed by the UI. */
export function normalizeDebounceDelay(value: unknown, fallback=250): number {
    const numericValue=typeof value==='number'?value:Number(value);
    if(!Number.isFinite(numericValue)) { return fallback; }
    return Math.min(10000, Math.max(100, Math.round(numericValue)));
}

/** Return a parsed settings object, excluding valid JSON primitives and arrays. */
export function normalizeSettingsRecord(value: unknown): Record<string, unknown> {
    return typeof value==='object'&&value!==null&&!Array.isArray(value)?
        value as Record<string, unknown>:{};
}

/** Normalize the persisted settings container before merging it with defaults. */
export function normalizeHierarchySettingsRecord(value: unknown): Record<string, unknown> {
    const settings=normalizeSettingsRecord(value);
    const {
        dashboardItems: _discardedDashboardItems,
        ...persistedSettings
    }=settings;
    const parameters=normalizeSettingsRecord(settings.parameters);
    const worksheet=normalizeSettingsRecord(settings.worksheet);
    return {
        ...persistedSettings,
        options: normalizeSettingsRecord(settings.options),
        parameters: {
            ...parameters,
            fields: stringArray(parameters.fields)
        },
        worksheet: {
            ...worksheet,
            fields: stringArray(worksheet.fields),
            filterTargets: filterTargetArray(worksheet.filterTargets)
        }
    };
}

/** Convert a complete base-10 integer without silently truncating invalid text. */
export function parseIntegerParameterValue(value: string): number|undefined {
    const normalized=value.trim();
    if(!/^[+-]?\d+$/.test(normalized)) { return undefined; }
    const numericValue=Number(normalized);
    return Number.isSafeInteger(numericValue)?numericValue:undefined;
}

function isItemCss(value: unknown): value is CSSProperties {
    if(typeof value!=='object'||value===null||Array.isArray(value)) { return false; }
    return Object.values(value).every(item => typeof item==='string'||typeof item==='number');
}

function stringArray(value: unknown): string[] {
    return Array.isArray(value)?value.filter((item): item is string => typeof item==='string'):[];
}

function filterTargetArray(value: unknown): Array<{ worksheetName: string, fieldName: string }> {
    if(!Array.isArray(value)) { return []; }
    return value.reduce<Array<{ worksheetName: string, fieldName: string }>>((targets, item) => {
        const target=normalizeSettingsRecord(item);
        if(typeof target.worksheetName==='string'&&typeof target.fieldName==='string') {
            targets.push({ worksheetName: target.worksheetName, fieldName: target.fieldName });
        }
        return targets;
    }, []);
}
