import { Worksheet } from '@tableau/extensions-api-types';
import { loadSummaryDataset } from '../API/SummaryData';
import { bindVizData, VizBinding } from './VizModel';

/** Coalesce refresh bursts and discard stale responses after a new event or disposal. */
export function createVizRefresh(
    worksheet: Worksheet,
    publish: (binding: VizBinding) => void,
    fail: (error: unknown) => void
): { refresh: () => void; dispose: () => void } {
    let disposed=false;
    let running=false;
    let revision=0;
    const refresh=(): void => {
        revision++;
        if(running||disposed) { return; }
        running=true;
        const run=async (): Promise<void> => {
            let loaded=0;
            try {
                while(!disposed&&loaded!==revision) {
                    loaded=revision;
                    try {
                        const spec=await worksheet.getVisualSpecificationAsync();
                        const dataset=await loadSummaryDataset(worksheet);
                        if(!disposed&&loaded===revision) { publish(bindVizData(spec, dataset, worksheet.name)); }
                    }
                    catch(error) { if(!disposed&&loaded===revision) { fail(error); } }
                }
            }
            finally { running=false; }
        };
        void run();
    };
    return { refresh, dispose: () => { disposed=true; } };
}

/** Serialize native mark selection so rapid clicks cannot finish in reverse order. */
export function createVizSelection(
    worksheet: Worksheet,
    replace: Parameters<Worksheet['selectMarksByValueAsync']>[1],
    fail: (error: unknown) => void
): { select: (binding: VizBinding, values: string[]) => void; dispose: () => void } {
    let queue=Promise.resolve();
    let revision=0;
    let disposed=false;
    return {
        select: (binding, values) => {
            const request=++revision;
            queue=queue.then(async () => {
                if(disposed||request!==revision) { return; }
                try {
                    if(!values.length) { await worksheet.clearSelectedMarksAsync(); }
                    else {
                        const selectionValues=values.map(key => binding.rawIds.get(key)).filter(value => value!==undefined);
                        if(selectionValues.length!==values.length) { throw new Error('Selection contains unavailable hierarchy IDs.'); }
                        await worksheet.selectMarksByValueAsync([{ fieldName: binding.idColumn.fieldName, value: selectionValues.map(String) }], replace);
                    }
                }
                catch(error) { if(!disposed) { fail(error); } }
            });
        },
        dispose: () => { disposed=true; revision++; }
    };
}
