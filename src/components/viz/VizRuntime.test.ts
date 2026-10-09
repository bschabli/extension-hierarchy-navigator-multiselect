import { strict as assert } from 'assert';
import { Column, DataTable, SelectionUpdateType, VisualSpecification, Worksheet } from '@tableau/extensions-api-types';
import { createVizRefresh, createVizSelection } from './VizRuntime';
import { VizBinding } from './VizModel';

const tick=(): Promise<void> => new Promise(resolve => setTimeout(resolve,0));
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise=new Promise<T>(done => { resolve=done; });
    return { promise, resolve };
}
async function test(): Promise<void> {
    const columns=['Label','ID'].map((fieldName,index) => ({ fieldId:fieldName,fieldName,index } as Column));
    const spec={activeMarksSpecificationIndex:0, marksSpecifications:[{encodings:[
        {id:'hierarchy',field:{fieldId:'Label'}},{id:'id',field:{fieldId:'ID'}}
    ]}]} as VisualSpecification;
    const first=deferred<DataTable>();
    let reads=0;
    let releases=0;
    const published: VizBinding[]=[];
    const errors: unknown[]=[];
    const table=(label:string): DataTable => ({ columns,data:[[{value:label},{value:'id'}]],totalRowCount:1 } as DataTable);
    const worksheet={name:'Viz',getVisualSpecificationAsync:async () => spec,
        getSummaryDataReaderAsync:async () => {
            reads++;
            const page=reads===1?first.promise:Promise.resolve(table('new'));
            return {pageCount:1,totalRowCount:1,getPageAsync:() => page,releaseAsync:async () => { releases++; }};
        }} as unknown as Worksheet;
    const runtime=createVizRefresh(worksheet,binding => published.push(binding),error => errors.push(error));
    runtime.refresh(); await tick(); runtime.refresh(); runtime.refresh();
    first.resolve(table('stale')); await tick(); await tick();
    assert.equal(reads,2,'Burst refreshes should coalesce.');
    assert.equal(releases,2,'All readers must be released.');
    assert.equal(published.length,1,'Stale data must not publish.');
    assert.equal(published[0].dataset.rows[0][0].value,'new');
    assert.equal(errors.length,0);
    runtime.dispose(); runtime.refresh(); await tick(); assert.equal(reads,2);

    const pending=deferred<DataTable>();
    const disposed=createVizRefresh({...worksheet,getSummaryDataReaderAsync:async () => ({
        pageCount:1,totalRowCount:1,getPageAsync:() => pending.promise,releaseAsync:async () => { releases++; }
    })} as unknown as Worksheet,() => assert.fail('Disposed loader published'),error => errors.push(error));
    disposed.refresh(); await tick(); disposed.dispose(); pending.resolve(table('ignored')); await tick();
    assert.equal(releases,3);

    const calls: string[][]=[];
    const selectionGate=deferred<void>();
    const selectionWorksheet={selectMarksByValueAsync:async (criteria: Array<{value:string[]}>) => {
        calls.push(criteria[0].value); if(calls.length===1) { await selectionGate.promise; }
    },clearSelectedMarksAsync:async () => { calls.push([]); }} as unknown as Worksheet;
    const selection=createVizSelection(selectionWorksheet,'replace' as SelectionUpdateType,error => errors.push(error));
    const binding={idColumn:{fieldName:'ID'},rawIds:new Map([['first',101],['last',102]])} as VizBinding;
    selection.select(binding,['first']); await tick();
    selection.select(binding,[]); selection.select(binding,['last']);
    assert.deepEqual(calls,[['101']]);
    selectionGate.resolve(); await tick();
    assert.deepEqual(calls,[['101'],['102']],'Only the latest queued selection should follow an in-flight selection.');
    selection.select(binding,[]); await tick(); assert.deepEqual(calls[2],[]);
    selection.select(binding,['missing']); await tick(); assert.equal(errors.length,1);
    selection.dispose(); selection.select(binding,['first']); await tick(); assert.equal(calls.length,3);
    console.log('Viz refresh lifecycle, paging cleanup and serialized selection tests passed.');
}
void test().catch(error => { console.error(error); process.exitCode=1; });
