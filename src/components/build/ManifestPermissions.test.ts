import * as fs from 'fs';
import * as path from 'path';

const FULL_DATA_PERMISSION='<permission>full data</permission>';
const PRIVILEGED_API_NAMES=[
    'getActiveTablesAsync',
    'getConnectionSummariesAsync',
    'getLogicalTableData',
    'getLogicalTables',
    'getUnderlyingDataAsync',
    'getUnderlyingTableDataAsync',
    'getUnderlyingTablesAsync'
];

function assert(condition: boolean, message: string): void {
    if(!condition) { throw new Error(message); }
}

function collectProductionSources(directory: string): string[] {
    const sources: string[]=[];
    for(const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const entryPath=path.join(directory, entry.name);
        if(entry.isDirectory()) {
            sources.push(...collectProductionSources(entryPath));
        }
        else if(/\.tsx?$/.test(entry.name)&&!entry.name.includes('.test.')) {
            sources.push(entryPath);
        }
    }
    return sources;
}

const sourceDirectory=path.join(process.cwd(), 'src');
const manifests=fs.readdirSync(sourceDirectory)
    .filter(fileName => fileName.endsWith('.trex'))
    .map(fileName => path.join(sourceDirectory, fileName));

assert(manifests.length>0, 'At least one Tableau extension manifest must be present.');
for(const manifest of manifests) {
    const source=fs.readFileSync(manifest, 'utf8');
    assert(
        !source.includes(FULL_DATA_PERMISSION),
        `${ path.basename(manifest) } must not request unused full-data access.`
    );
}

const productionSources=collectProductionSources(path.join(sourceDirectory, 'components'));
for(const sourcePath of productionSources) {
    const source=fs.readFileSync(sourcePath, 'utf8');
    for(const apiName of PRIVILEGED_API_NAMES) {
        assert(
            !source.includes(apiName),
            `${ path.relative(process.cwd(), sourcePath) } uses ${ apiName }; review Tableau full-data permission requirements.`
        );
    }
}

console.log('Manifest permission tests passed.');
