import { detectTableauApiCapabilities } from './DiagnosticsModel';

function assert(condition: boolean, message: string): void {
    if(!condition) { throw new Error(message); }
}

const capabilities=detectTableauApiCapabilities({
    addEventListener: () => undefined,
    applyFilterAsync: () => Promise.resolve(),
    getSummaryDataReaderAsync: () => Promise.resolve(),
    selectMarksByValueAsync: () => Promise.resolve()
}, {
    settings: { saveAsync: () => Promise.resolve() }
});
assert(capabilities.pagedSummaryData, 'Paged summary data support should be detected.');
assert(capabilities.sourceDataEvents, 'Summary-data event support should be detected.');
assert(capabilities.categoricalFiltering, 'Filter support should be detected.');
assert(capabilities.settingsPersistence, 'Settings persistence should be detected.');
assert(!capabilities.summaryColumnMetadata, 'Missing optional APIs should be reported as unavailable.');

console.log('Diagnostics capability tests passed.');
