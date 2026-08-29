export const CURRENT_CONFIGURATION_SCHEMA_VERSION=3;

export interface ConfigurationMigrationReport {
    changes: string[];
    fromVersion: number;
    migrated: boolean;
    toVersion: number;
}

export interface MigratedConfiguration {
    report: ConfigurationMigrationReport;
    settings: Record<string, unknown>;
}

/** Upgrade a persisted configuration without depending on live dashboard metadata. */
export function migrateHierarchyConfiguration(value: unknown): MigratedConfiguration {
    const original=asRecord(value);
    const settings=cloneRecord(original);
    const fromVersion=resolveSchemaVersion(settings.schemaVersion);
    const changes: string[]=[];
    const worksheet={ ...asRecord(settings.worksheet) };
    const options={ ...asRecord(settings.options) };

    if(!Array.isArray(worksheet.filterTargets)) {
        const worksheetName=typeof worksheet.targetName==='string'?worksheet.targetName:'';
        const fieldName=typeof worksheet.targetFilter==='string'&&worksheet.targetFilter!==''?
            worksheet.targetFilter:typeof worksheet.filter==='string'?worksheet.filter:'';
        if(worksheetName&&fieldName) {
            worksheet.filterTargets=[{ fieldName, valueSource: 'id', worksheetName }];
            changes.push('Converted the legacy single filter target to the multi-target format.');
        }
    }

    if(Array.isArray(worksheet.filterTargets)) {
        let addedValueMappings=false;
        worksheet.filterTargets=worksheet.filterTargets.map(item => {
            const target={ ...asRecord(item) };
            if(!isValueSource(target.valueSource)) {
                target.valueSource='id';
                addedValueMappings=true;
            }
            return target;
        });
        if(addedValueMappings) {
            changes.push('Assigned the legacy Unique ID value mapping to existing filter targets.');
        }
    }

    if(!('selectionBehavior' in options)&&Object.keys(original).length>0) {
        changes.push('Preserved the legacy parent-selection behavior for this hierarchy format.');
    }
    if('dashboardItems' in settings) {
        delete settings.dashboardItems;
        changes.push('Removed stale dashboard metadata so Tableau can discover it again.');
    }

    settings.options=options;
    settings.worksheet=worksheet;
    settings.schemaVersion=CURRENT_CONFIGURATION_SCHEMA_VERSION;
    if(fromVersion<CURRENT_CONFIGURATION_SCHEMA_VERSION&&changes.length===0) {
        changes.push('Updated the configuration format metadata.');
    }
    return {
        report: {
            changes,
            fromVersion,
            migrated: changes.length>0||fromVersion<CURRENT_CONFIGURATION_SCHEMA_VERSION,
            toVersion: CURRENT_CONFIGURATION_SCHEMA_VERSION
        },
        settings
    };
}

function asRecord(value: unknown): Record<string, unknown> {
    return typeof value==='object'&&value!==null&&!Array.isArray(value)?value as Record<string, unknown>:{};
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
    try { return JSON.parse(JSON.stringify(value)) as Record<string, unknown>; }
    catch(_error) { return { ...value }; }
}

function isValueSource(value: unknown): boolean {
    return value==='id'||value==='label'||value==='path'||value==='level';
}

function resolveSchemaVersion(value: unknown): number {
    return typeof value==='number'&&Number.isInteger(value)&&value>=1?
        Math.min(value, CURRENT_CONFIGURATION_SCHEMA_VERSION):1;
}
