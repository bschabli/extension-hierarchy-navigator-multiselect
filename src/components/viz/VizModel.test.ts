import { strict as assert } from 'assert';
import { Column, DataValue, VisualSpecification } from '@tableau/extensions-api-types';
import { SummaryDataset } from '../API/SummaryData';
import { buildFlatTree, buildRecursiveTree } from '../extension/TreeModel';
import { bindVizData, defaultVizPreferences, parseVizPreferences } from './VizModel';
import { flattenVisibleTree } from '../extension/VisibleTree';

const columns=['Region', 'Product', 'ID', 'SUM(Sales)', 'Parent'].map((fieldName, index) => ({
    fieldId: `field-${index}`, fieldName, index, dataType: 'string', isReferenced: true
} as Column));
const cell=(value: unknown, formattedValue=String(value)): DataValue => ({ value, nativeValue: value, formattedValue } as DataValue);
const dataset: SummaryDataset={ columns, rows: [
    [cell('Europe'), cell('Desk'), cell(101, 'Item 101'), cell(1200, '1.200 €'), cell(null)],
    [cell('Europe'), cell('Chair'), cell(102, 'Item 102'), cell(400, '400 €'), cell(101, 'Parent 101')]
], totalRowCount: 2, limited: false };
function specification(mapping: Array<[string, number]>): VisualSpecification {
    return { activeMarksSpecificationIndex: 1, marksSpecifications: [{ encodings: [] }, { encodings: mapping.map(([id, column]) => ({
        id, field: { fieldId: columns[column].fieldId, name: 'A different localized name' }
    })) }] } as VisualSpecification;
}
const flatSpec=specification([['hierarchy',0],['hierarchy',1],['id',2]]);
const binding=bindVizData(flatSpec, dataset, 'Hierarchy');
assert.deepEqual(binding.data.worksheet.fields, ['Region','Product']);
assert.equal(binding.idColumn.fieldName, 'ID');
assert.equal(binding.rawIds.get('101'), 101);
assert.equal(binding.dataset.rows[0][binding.keyColumnIndex].formattedValue, '101');
assert.equal(dataset.rows[0][2].formattedValue, 'Item 101', 'Must not mutate Tableau data.');
const tree=buildFlatTree(binding.dataset.rows,[0,1],binding.keyColumnIndex);
let clicked='';
const visible=flattenVisibleTree(tree,new Set([tree[0].key]),item => { clicked=item.key; });
assert.equal(visible.length,3);
visible[1].onClick();
assert.equal(clicked,`${tree[0].key}/${tree[0].nodes[0].key}`);
assert.equal(flattenVisibleTree(tree,new Set(),() => undefined).length,1);
const recursive=bindVizData(specification([['hierarchy',1],['id',2],['parent',4]]),dataset,'Recursive');
const recursiveTree=buildRecursiveTree(recursive.dataset.rows,recursive.dataset.columns.find(column => column.fieldName===recursive.data.worksheet.parentId)!.index,recursive.keyColumnIndex,1);
assert.equal(recursiveTree[0].nodes[0].label,'Chair','Raw parent IDs must match raw node IDs despite formatting.');
assert.throws(() => bindVizData(flatSpec,{...dataset,limited:true},'Hierarchy'),/incomplete/);
assert.throws(() => bindVizData(specification([['hierarchy',0]]),dataset,'Hierarchy'),/Node ID/);
assert.throws(() => bindVizData(specification([['hierarchy',0],['hierarchy',1],['parent',4],['id',2]]),dataset,'Hierarchy'),/Recursive/);
assert.throws(() => bindVizData(flatSpec,{...dataset,rows:[dataset.rows[0],dataset.rows[0]]},'Hierarchy'),/more than once/);
assert.throws(() => bindVizData(flatSpec,{...dataset,columns:columns.filter(c => c.index!==0)},'Hierarchy'),/Missing encoded/);
const empty=bindVizData(flatSpec,{...dataset,rows:[],totalRowCount:0},'Hierarchy');
assert.equal(empty.dataset.rows.length,0);
assert.deepEqual(parseVizPreferences(JSON.stringify(defaultVizPreferences)),defaultVizPreferences);
assert.throws(() => parseVizPreferences('{"version":2}'),/Unsupported/);
assert.throws(() => parseVizPreferences('null'),/Unsupported/);
assert.deepEqual(parseVizPreferences(JSON.stringify({...defaultVizPreferences,view:'table'})),defaultVizPreferences,
    'Obsolete combined-prototype settings must not restore a table mode.');
const sameField=bindVizData(specification([['hierarchy',2],['id',2]]),dataset,'Aliased IDs');
const sameFieldTree=buildFlatTree(sameField.dataset.rows,[2],sameField.keyColumnIndex);
assert.equal(sameFieldTree[0].label,'Item 101','An ID used as a label must preserve its display alias.');
assert.equal(sameFieldTree[0].directFilterValues[0],'101');
const sparse={...dataset,rows:[[cell('Europe'),cell(null),cell(1),cell(10),cell(null)]],totalRowCount:1};
assert.equal(bindVizData(flatSpec,sparse,'Ragged').dataset.rows.length,1);
assert.throws(() => bindVizData(flatSpec,{...sparse,rows:[[cell('Europe'),cell('Desk'),cell(null),cell(10),cell(null)]]},'Missing ID'),/blank/);
console.log('Navigator binding, visible rows and settings tests passed.');
