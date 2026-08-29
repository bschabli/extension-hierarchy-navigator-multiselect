import {
    FilterTarget,
    resolveFilterTargetLevel,
    resolveFilterValueSource
} from '../API/FilterTargets';
import { NormalizedTreeNode } from './TreeModel';

export interface HierarchyFilterValueRecord {
    id: string;
    label: string;
    levels: Array<string|undefined>;
    path: string;
}

/** Build the selectable value metadata shared by target previews and live filters. */
export function buildHierarchyFilterValueRecords(
    nodes: readonly NormalizedTreeNode[],
    selectedIds: ReadonlySet<string>|readonly string[],
    separator: string
): HierarchyFilterValueRecord[] {
    const selected=selectedIds instanceof Set?selectedIds:new Set(selectedIds);
    const records: HierarchyFilterValueRecord[]=[];
    const seenIds=new Set<string>();

    function addNodes(currentNodes: readonly NormalizedTreeNode[], parentLabels: readonly string[]): void {
        currentNodes.forEach(node => {
            const pathLabels=parentLabels.concat(node.label);
            const levels=node.sourcePathValues.length?node.sourcePathValues.slice():pathLabels.slice();
            node.directFilterValues.forEach(id => {
                if(!selected.has(id)||seenIds.has(id)) { return; }
                seenIds.add(id);
                records.push({
                    id,
                    label: node.label,
                    levels,
                    path: pathLabels.join(separator)
                });
            });
            addNodes(node.nodes, pathLabels);
        });
    }

    addNodes(nodes, []);
    return records;
}

/** Convert selected hierarchy records to the distinct values configured for one target. */
export function resolveMappedFilterValues(
    target: Pick<FilterTarget, 'valueSource'|'levelIndex'>,
    records: readonly HierarchyFilterValueRecord[]
): string[] {
    const valueSource=resolveFilterValueSource(target.valueSource);
    const levelIndex=resolveFilterTargetLevel(target.levelIndex);
    const values=new Set<string>();
    records.forEach(record => {
        const value=valueSource==='label'?record.label:
            valueSource==='path'?record.path:
                valueSource==='level'?record.levels[levelIndex]:record.id;
        if(typeof value==='string'&&value!=='') { values.add(value); }
    });
    return Array.from(values);
}

/** Return the greatest visual depth represented by a hierarchy tree. */
export function getHierarchyDepth(nodes: readonly NormalizedTreeNode[]): number {
    return nodes.reduce((depth, node) => Math.max(depth, 1+getHierarchyDepth(node.nodes)), 0);
}
