import type { CSSProperties } from 'react';
import {
    FilterTarget,
    resolveFilterTargetLevel,
    resolveFilterValueSource
} from './FilterTargets';

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
    removeInvalidSettingsProperties(persistedSettings, {
        configComplete: isBoolean,
        paramSuffix: isString,
        separator: value => typeof value==='string'&&value.length>0,
        type: value => value==='flat'||value==='recursive'
    });

    const options={ ...normalizeSettingsRecord(settings.options) };
    removeInvalidSettingsProperties(options, {
        bgColor: isString,
        closedIconAscii: isString,
        closedIconBase64Image: isString,
        closedIconType: isIconType,
        dashboardListenersEnabled: isBoolean,
        debug: isBoolean,
        debounce: value => typeof value==='number'&&Number.isFinite(value),
        fontColor: isString,
        fontFamily: isString,
        fontSize: isString,
        highlightColor: isString,
        itemCSS: isItemCss,
        openedIconAscii: isString,
        openedIconBase64Image: isString,
        openedIconType: isIconType,
        searchAutoExpand: isBoolean,
        searchEnabled: isBoolean,
        selectionBehavior: value => value==='terminal'||value==='subtree'||value==='node',
        title: isString,
        titleEnabled: isBoolean,
        warningEnabled: isBoolean
    });
    if(typeof options.debounce==='number') {
        options.debounce=normalizeDebounceDelay(options.debounce);
    }

    const parameters={ ...normalizeSettingsRecord(settings.parameters) };
    removeInvalidSettingsProperties(parameters, {
        childId: isString,
        childIdEnabled: isBoolean,
        childLabel: isString,
        childLabelEnabled: isBoolean,
        level: isString
    });
    parameters.fields=stringArray(parameters.fields);

    const worksheet={ ...normalizeSettingsRecord(settings.worksheet) };
    removeInvalidSettingsProperties(worksheet, {
        childId: isString,
        childLabel: isString,
        enableMarkSelection: isBoolean,
        filter: isString,
        filterEnabled: isBoolean,
        name: isString,
        parentId: isString,
        status: value => typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<=3,
        targetFilter: isString,
        targetName: isString
    });
    worksheet.fields=stringArray(worksheet.fields);
    worksheet.filterTargets=filterTargetArray(worksheet.filterTargets);

    return {
        ...persistedSettings,
        options,
        parameters,
        worksheet
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

function isBoolean(value: unknown): value is boolean {
    return typeof value==='boolean';
}

function isIconType(value: unknown): boolean {
    return value==='Default'||value==='Base64 Image'||value==='Ascii';
}

function isString(value: unknown): value is string {
    return typeof value==='string';
}

function removeInvalidSettingsProperties(
    settings: Record<string, unknown>,
    validators: Record<string, (value: unknown) => boolean>
): void {
    Object.entries(validators).forEach(([key, validator]) => {
        if(key in settings&&!validator(settings[key])) { delete settings[key]; }
    });
}

function stringArray(value: unknown): string[] {
    return Array.isArray(value)?value.filter((item): item is string => typeof item==='string'):[];
}

function filterTargetArray(value: unknown): FilterTarget[] {
    if(!Array.isArray(value)) { return []; }
    return value.reduce<FilterTarget[]>((targets, item) => {
        const target=normalizeSettingsRecord(item);
        if(typeof target.worksheetName==='string'&&typeof target.fieldName==='string') {
            const valueSource=resolveFilterValueSource(target.valueSource);
            targets.push({
                worksheetName: target.worksheetName,
                fieldName: target.fieldName,
                valueSource,
                ...(valueSource==='level'?{ levelIndex: resolveFilterTargetLevel(target.levelIndex) }: {})
            });
        }
        return targets;
    }, []);
}
