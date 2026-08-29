import { HierarchyProps, defaultSelectedProps } from './Interfaces';
import { normalizeHierarchySettingsRecord } from './ConfigurationModel';
import {
    CURRENT_CONFIGURATION_SCHEMA_VERSION,
    ConfigurationMigrationReport,
    migrateHierarchyConfiguration
} from './ConfigurationMigration';

const CONFIGURATION_FORMAT='hierarchy-navigator-configuration';

export interface ParsedConfigurationPackage {
    report: ConfigurationMigrationReport;
    settings: Record<string, unknown>;
}

/** Serialize only portable settings, excluding live Tableau dashboard metadata. */
export function serializeHierarchyConfiguration(data: HierarchyProps): string {
    const configuration=JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
    delete configuration.dashboardItems;
    configuration.schemaVersion=CURRENT_CONFIGURATION_SCHEMA_VERSION;
    return JSON.stringify({
        configuration,
        format: CONFIGURATION_FORMAT,
        schemaVersion: CURRENT_CONFIGURATION_SCHEMA_VERSION
    }, null, 2);
}

/** Parse, migrate, and normalize an exported or legacy raw configuration object. */
export function parseHierarchyConfiguration(text: string): ParsedConfigurationPackage {
    const parsed: unknown=JSON.parse(text);
    if(typeof parsed!=='object'||parsed===null||Array.isArray(parsed)) {
        throw new Error('Configuration JSON must contain an object.');
    }
    const record=parsed as Record<string, unknown>;
    if('format' in record&&record.format!==CONFIGURATION_FORMAT) {
        throw new Error('This JSON file is not a Hierarchy Navigator configuration.');
    }
    const rawSettings='configuration' in record?record.configuration:record;
    if(!isRecord(rawSettings)||!['configComplete', 'options', 'parameters', 'separator', 'type', 'worksheet']
        .some(key => key in rawSettings)) {
        throw new Error('The configuration does not contain any supported settings.');
    }
    if(typeof rawSettings.schemaVersion==='number'&&
        rawSettings.schemaVersion>CURRENT_CONFIGURATION_SCHEMA_VERSION) {
        throw new Error('This configuration was created by a newer extension version.');
    }
    const migrated=migrateHierarchyConfiguration(rawSettings);
    const settings=normalizeHierarchySettingsRecord(migrated.settings);
    return { report: migrated.report, settings };
}

/** Return a portable filename that is safe across common operating systems. */
export function getConfigurationExportFilename(data: Pick<HierarchyProps, 'worksheet'>): string {
    const worksheetName=data.worksheet.name.trim().replace(/[^a-z0-9._-]+/gi, '-')||'configuration';
    return `hierarchy-navigator-${ worksheetName }.json`;
}

/** Merge imported portable settings with defaults while preserving live metadata. */
export function hydrateImportedConfiguration(
    settings: Record<string, unknown>,
    liveData: HierarchyProps
): HierarchyProps {
    const hydrated=mergeRecords(
        JSON.parse(JSON.stringify(defaultSelectedProps)) as Record<string, unknown>,
        settings
    ) as unknown as HierarchyProps;
    hydrated.dashboardItems=liveData.dashboardItems;
    hydrated.schemaVersion=CURRENT_CONFIGURATION_SCHEMA_VERSION;
    return hydrated;
}

function mergeRecords(
    base: Record<string, unknown>,
    additions: Record<string, unknown>
): Record<string, unknown> {
    Object.entries(additions).forEach(([key, value]) => {
        if(key==='__proto__'||key==='constructor'||key==='prototype') { return; }
        if(isRecord(value)&&isRecord(base[key])) {
            base[key]=mergeRecords({ ...base[key] as Record<string, unknown> }, value);
        }
        else if(Array.isArray(value)) {
            base[key]=value.slice();
        }
        else {
            base[key]=value;
        }
    });
    return base;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value==='object'&&value!==null&&!Array.isArray(value);
}
