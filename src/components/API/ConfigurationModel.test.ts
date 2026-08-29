import {
    normalizeDebounceDelay,
    normalizeItemCss,
    normalizeHierarchySettingsRecord,
    normalizeSettingsRecord,
    parseIntegerParameterValue,
    parseItemCss,
    updateParameterSelection
} from './ConfigurationModel';

function assert(condition: boolean, message: string): void {
    if(!condition) { throw new Error(message); }
}

function assertThrows(callback: () => void, message: string): void {
    try {
        callback();
    }
    catch(_error) {
        return;
    }
    throw new Error(message);
}

function testParameterSelection(): void {
    const idChange=updateParameterSelection(
        { childId: 'ID output', childLabel: 'Label output' },
        'childId',
        'Label output'
    );
    assert(idChange.childId==='Label output', 'The requested ID parameter should be selected.');
    assert(idChange.childLabel==='ID output', 'A conflicting label parameter should swap to the old ID parameter.');

    const labelChange=updateParameterSelection(
        { childId: 'ID output', childLabel: 'Label output' },
        'childLabel',
        'ID output'
    );
    assert(labelChange.childId==='Label output', 'A conflicting ID parameter should swap to the old label parameter.');
    assert(labelChange.childLabel==='ID output', 'The requested label parameter should be selected.');
}

function testItemCssValidation(): void {
    const parsed=parseItemCss('{"overflow":"hidden","lineHeight":1.5}');
    assert(parsed.overflow==='hidden', 'A CSS object with string and number values should be accepted.');
    assertThrows(() => parseItemCss('null'), 'Null must not be accepted as React item CSS.');
    assertThrows(() => parseItemCss('["hidden"]'), 'Arrays must not be accepted as React item CSS.');
    assertThrows(() => parseItemCss('{"overflow":true}'), 'Boolean CSS values must not be accepted.');

    const fallback={ overflow: 'hidden' };
    assert(normalizeItemCss('invalid', fallback)===fallback, 'Malformed saved CSS should use the safe fallback.');
}

function testDebounceNormalization(): void {
    assert(normalizeDebounceDelay(425.6)===426, 'Listener delays should be rounded to whole milliseconds.');
    assert(normalizeDebounceDelay(-10)===100, 'Listener delays should respect the UI minimum.');
    assert(normalizeDebounceDelay(20000)===10000, 'Listener delays should respect the UI maximum.');
    assert(normalizeDebounceDelay('invalid')===250, 'Malformed listener delays should use the default.');
}

function testSettingsAndIntegerNormalization(): void {
    assert(Object.keys(normalizeSettingsRecord(null)).length===0, 'Null settings should fall back to an empty object.');
    assert(Object.keys(normalizeSettingsRecord([])).length===0, 'Array settings should fall back to an empty object.');
    assert(normalizeSettingsRecord({ configComplete: true }).configComplete===true, 'Settings objects should be retained.');
    const settings=normalizeHierarchySettingsRecord({
        dashboardItems: { worksheets: ['stale'] },
        options: null,
        parameters: { fields: ['valid', 1] },
        worksheet: {
            fields: 'invalid',
            filterTargets: ['invalid', { worksheetName: 'Sales', fieldName: 'ID' }]
        }
    });
    assert(!('dashboardItems' in settings), 'Live dashboard metadata must not be restored from saved settings.');
    assert((settings.parameters as { fields: string[] }).fields.join(',')==='valid', 'Parameter fields should contain strings only.');
    assert((settings.worksheet as { fields: string[] }).fields.length===0, 'Malformed worksheet fields should be cleared.');
    assert(
        (settings.worksheet as { filterTargets: unknown[] }).filterTargets.length===1,
        'Malformed filter targets should be discarded.'
    );
    assert(parseIntegerParameterValue('42')===42, 'Complete integer strings should be converted.');
    assert(parseIntegerParameterValue('-7')===-7, 'Signed integer strings should be converted.');
    assert(typeof parseIntegerParameterValue('12abc')==='undefined', 'Partial numeric strings must not be truncated.');
    assert(typeof parseIntegerParameterValue('1.5')==='undefined', 'Decimal strings must not be truncated to integers.');
}

testParameterSelection();
testItemCssValidation();
testDebounceNormalization();
testSettingsAndIntegerNormalization();
console.log('Configuration model tests passed.');
