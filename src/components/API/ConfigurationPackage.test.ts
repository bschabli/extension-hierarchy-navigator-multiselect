import { defaultSelectedProps } from './Interfaces';
import {
    getConfigurationExportFilename,
    hydrateImportedConfiguration,
    parseHierarchyConfiguration,
    serializeHierarchyConfiguration
} from './ConfigurationPackage';

function assert(condition: boolean, message: string): void {
    if(!condition) { throw new Error(message); }
}

const liveData={
    ...defaultSelectedProps,
    dashboardItems: {
        ...defaultSelectedProps.dashboardItems,
        worksheets: ['Hierarchy Source', 'Sales']
    },
    worksheet: {
        ...defaultSelectedProps.worksheet,
        childId: 'ID',
        fields: ['Category'],
        name: 'Hierarchy Source'
    }
};
const exported=serializeHierarchyConfiguration(liveData);
assert(!exported.includes('dashboardItems'), 'Exports must exclude live Tableau metadata.');
const parsed=parseHierarchyConfiguration(exported);
assert(
    (parsed.settings.worksheet as { name: string }).name==='Hierarchy Source',
    'Exported settings should round-trip through the parser.'
);
const hydrated=hydrateImportedConfiguration(parsed.settings, liveData);
assert(
    hydrated.dashboardItems.worksheets.join(',')==='Hierarchy Source,Sales',
    'Imports should preserve currently discovered Tableau metadata.'
);
assert(
    getConfigurationExportFilename(liveData)==='hierarchy-navigator-Hierarchy-Source.json',
    'Export filenames should include a portable worksheet name.'
);

let rejected=false;
try { parseHierarchyConfiguration('{"format":"another-application"}'); }
catch(_error) { rejected=true; }
assert(rejected, 'Foreign JSON packages should be rejected.');

rejected=false;
try { parseHierarchyConfiguration('{}'); }
catch(_error) { rejected=true; }
assert(rejected, 'Empty JSON objects should be rejected.');

rejected=false;
try {
    parseHierarchyConfiguration(JSON.stringify({
        schemaVersion: 999,
        worksheet: {}
    }));
}
catch(_error) { rejected=true; }
assert(rejected, 'Configurations from unsupported future schemas should be rejected.');

const prototypeSafe=hydrateImportedConfiguration(
    JSON.parse('{"worksheet":{},"__proto__":{"polluted":true}}'),
    liveData
);
assert(
    !(prototypeSafe as unknown as Record<string, unknown>).polluted,
    'Imported configuration keys must not mutate the hydrated object prototype.'
);

console.log('Configuration package tests passed.');
