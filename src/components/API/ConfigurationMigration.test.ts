import {
    CURRENT_CONFIGURATION_SCHEMA_VERSION,
    migrateHierarchyConfiguration
} from './ConfigurationMigration';

function assert(condition: boolean, message: string): void {
    if(!condition) { throw new Error(message); }
}

const migrated=migrateHierarchyConfiguration({
    configComplete: true,
    dashboardItems: { worksheets: ['stale'] },
    options: {},
    worksheet: {
        filter: 'Product ID',
        targetName: 'Sales'
    }
});
const migratedWorksheet=migrated.settings.worksheet as {
    filterTargets: Array<{ fieldName: string, valueSource: string, worksheetName: string }>
};
assert(migrated.report.fromVersion===1, 'Unversioned configurations should be treated as schema version 1.');
assert(migrated.report.migrated, 'Legacy configuration changes should be reported.');
assert(migratedWorksheet.filterTargets.length===1, 'The legacy filter target should be migrated.');
assert(migratedWorksheet.filterTargets[0].valueSource==='id', 'Legacy targets should receive ID mapping.');
assert(!('dashboardItems' in migrated.settings), 'Stale dashboard metadata should not survive migration.');
assert(
    migrated.settings.schemaVersion===CURRENT_CONFIGURATION_SCHEMA_VERSION,
    'Migrated settings should carry the current schema version.'
);

const current=migrateHierarchyConfiguration({
    schemaVersion: CURRENT_CONFIGURATION_SCHEMA_VERSION,
    options: { selectionBehavior: 'terminal' },
    worksheet: { filterTargets: [] }
});
assert(!current.report.migrated, 'Current normalized settings should not report a migration.');

console.log('Configuration migration tests passed.');
