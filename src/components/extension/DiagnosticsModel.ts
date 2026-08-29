export type HierarchyRefreshMode='full'|'incremental'|'unchanged';

export interface TableauApiCapabilities {
    categoricalFiltering: boolean;
    pagedSummaryData: boolean;
    settingsPersistence: boolean;
    sourceDataEvents: boolean;
    summaryColumnMetadata: boolean;
    sourceMarkSelection: boolean;
}

export interface HierarchyLoadDiagnostics {
    loadTimeMs: number;
    nodeCount: number;
    refreshMode: HierarchyRefreshMode;
    reusedNodeCount: number;
    rowCount: number;
    virtualizationEnabled: boolean;
}

export interface HierarchyRuntimeDiagnostics extends HierarchyLoadDiagnostics {
    capabilities: TableauApiCapabilities;
    filtersApplied: number;
}

/** Detect optional Tableau APIs without invoking or mutating the dashboard. */
export function detectTableauApiCapabilities(
    worksheet: Record<string, unknown>|undefined,
    extensions: Record<string, unknown>|undefined
): TableauApiCapabilities {
    const settings=asRecord(extensions?.settings);
    return {
        categoricalFiltering: typeof worksheet?.applyFilterAsync==='function',
        pagedSummaryData: typeof worksheet?.getSummaryDataReaderAsync==='function',
        settingsPersistence: typeof settings.saveAsync==='function',
        sourceDataEvents: typeof worksheet?.addEventListener==='function',
        summaryColumnMetadata: typeof worksheet?.getSummaryColumnsInfoAsync==='function',
        sourceMarkSelection: typeof worksheet?.selectMarksByValueAsync==='function'
    };
}

function asRecord(value: unknown): Record<string, unknown> {
    return typeof value==='object'&&value!==null?value as Record<string, unknown>:{};
}
