import { SelectionBehavior } from '../API/SelectionBehavior';

export type CheckboxState='none'|'some'|'all';

export interface TableauCellLike {
    formattedValue?: unknown;
    nativeValue?: unknown;
    value?: unknown;
}

export type HierarchyCell=TableauCellLike|unknown;

export interface NormalizedTreeNode {
    /** Unique visual identity. Flat IDs include the complete path and source levels. */
    key: string;
    /** Value used by the existing parameter integration for the active node. */
    hierarchyValue: string;
    label: string;
    /** Filter values attached directly to source rows ending at this node. */
    directFilterValues: string[];
    /** Filter values attached to visual leaves below this node. */
    terminalFilterValues: string[];
    /** Every directly represented filter value in this node's subtree. */
    subtreeFilterValues: string[];
    /** Original zero-based source levels represented by this node. */
    sourceLevels: number[];
    /** Values at their original Flat field positions for parameter compatibility. */
    sourcePathValues: Array<string|undefined>;
    nodes: NormalizedTreeNode[];
}

interface FlatNodeBuilder {
    key: string;
    hierarchyValue: string;
    label: string;
    sourceLevels: number[];
    sourcePathValues: Array<string|undefined>;
    directFilterValues: Set<string>;
    children: Map<string, FlatNodeBuilder>;
}

interface RecursiveRecord {
    id: string;
    label: string;
    parentId?: string;
}

/**
 * Return the usable value of a Tableau data cell.
 *
 * Raw values are preferred so a formatted label such as "Null" is not mistaken
 * for a real value when Tableau reports a genuine null.
 */
export function getHierarchyValue(cell: HierarchyCell): unknown {
    if(isTableauCell(cell)) {
        if(Object.prototype.hasOwnProperty.call(cell, 'nativeValue')&&typeof cell.nativeValue!=='undefined') {
            return cell.nativeValue;
        }
        if(Object.prototype.hasOwnProperty.call(cell, 'value')) {
            return cell.value;
        }
        return cell.formattedValue;
    }
    return cell;
}

/** Return whether a hierarchy value represents a missing level. */
export function isMissingHierarchyValue(cell: HierarchyCell): boolean {
    const value=getHierarchyValue(cell);
    return value===null||typeof value==='undefined'||
        (typeof value==='string'&&(value.trim()===''||value==='%null%'));
}

/** Return a display/filter string, or undefined for a missing value. */
export function normalizeHierarchyValue(cell: HierarchyCell): string|undefined {
    if(isMissingHierarchyValue(cell)) { return undefined; }
    if(isTableauCell(cell)&&typeof cell.formattedValue!=='undefined'&&cell.formattedValue!==null) {
        const formatted=String(cell.formattedValue).trim();
        return formatted===''? undefined:formatted;
    }
    return String(getHierarchyValue(cell)).trim();
}

/**
 * Build one normalized tree from dimensional rows.
 *
 * Missing levels are skipped, so the next real value attaches to the closest
 * preceding real node. The row's ID value is attached to its terminal node even
 * when that node also has children in other rows.
 */
export function buildFlatTree(
    rows: HierarchyCell[][],
    hierarchyColumnIndexes: number[],
    filterValueColumnIndex: number,
    separator='|'
): NormalizedTreeNode[] {
    const roots=new Map<string, FlatNodeBuilder>();

    rows.forEach(row => {
        const path=hierarchyColumnIndexes.reduce<Array<{ label: string, level: number }>>((values, columnIndex, level) => {
            const label=normalizeHierarchyValue(row[columnIndex]);
            if(typeof label!=='undefined') { values.push({ label, level }); }
            return values;
        }, []);
        if(path.length===0) { return; }

        let siblings=roots;
        const keyParts: string[]=[];
        const hierarchyParts: string[]=[];
        const sourcePathValues: Array<string|undefined>=[];
        let terminal: FlatNodeBuilder|undefined;
        path.forEach(pathPart => {
            keyParts.push(`L${ pathPart.level + 1 }:${ encodeKeyPart(pathPart.label) }`);
            hierarchyParts.push(pathPart.label);
            sourcePathValues[pathPart.level]=pathPart.label;
            const key=`flat:${ keyParts.join('|') }`;
            let node=siblings.get(key);
            if(typeof node==='undefined') {
                node={
                    children: new Map<string, FlatNodeBuilder>(),
                    hierarchyValue: hierarchyParts.join(separator),
                    key,
                    label: pathPart.label,
                    sourceLevels: [pathPart.level],
                    sourcePathValues: sourcePathValues.slice(),
                    directFilterValues: new Set<string>()
                };
                siblings.set(key, node);
            }
            terminal=node;
            siblings=node.children;
        });

        const filterValue=normalizeHierarchyValue(row[filterValueColumnIndex]);
        if(terminal&&typeof filterValue!=='undefined') {
            terminal.directFilterValues.add(filterValue);
        }
    });

    return finalizeFlatNodes(roots);
}

/** Build a normalized tree from recursive parent/child rows. */
export function buildRecursiveTree(
    rows: HierarchyCell[][],
    parentIdColumnIndex: number,
    nodeIdColumnIndex: number,
    labelColumnIndex: number
): NormalizedTreeNode[] {
    const records=new Map<string, RecursiveRecord>();
    rows.forEach(row => {
        const id=normalizeHierarchyValue(row[nodeIdColumnIndex]);
        if(typeof id==='undefined'||records.has(id)) { return; }
        const label=normalizeHierarchyValue(row[labelColumnIndex])||id;
        const normalizedParentId=normalizeHierarchyValue(row[parentIdColumnIndex]);
        records.set(id, {
            id,
            label,
            parentId: normalizedParentId==='0'? undefined:normalizedParentId
        });
    });

    const childrenByParent=new Map<string, RecursiveRecord[]>();
    records.forEach(record => {
        if(typeof record.parentId==='undefined'||record.parentId===record.id||!records.has(record.parentId)) { return; }
        const children=childrenByParent.get(record.parentId)||[];
        children.push(record);
        childrenByParent.set(record.parentId, children);
    });

    const built=new Set<string>();
    const roots: NormalizedTreeNode[]=[];
    const rootRecords=Array.from(records.values()).filter(record =>
        typeof record.parentId==='undefined'||record.parentId===record.id||!records.has(record.parentId)
    );
    rootRecords.forEach(record => roots.push(buildRecursiveNode(record, childrenByParent, built, new Set<string>())));

    // Preserve malformed/cyclic components as safe additional roots instead of
    // silently dropping them or recursing forever.
    records.forEach(record => {
        if(!built.has(record.id)) {
            roots.push(buildRecursiveNode(record, childrenByParent, built, new Set<string>()));
        }
    });
    return sortTree(roots);
}

/** Return the filter values controlled by a node for the selected behavior. */
export function getNodeSelectionValues(
    node: NormalizedTreeNode,
    behavior: SelectionBehavior
): string[] {
    switch(behavior) {
        case SelectionBehavior.SUBTREE: return node.subtreeFilterValues;
        case SelectionBehavior.NODE: return node.directFilterValues;
        default: return node.terminalFilterValues;
    }
}

/** Return a node's derived checkbox state for the configured selection behavior. */
export function getSelectionState(
    node: NormalizedTreeNode,
    selectedFilterValues: ReadonlySet<string>,
    behavior=SelectionBehavior.TERMINAL
): CheckboxState {
    const controlledValues=getNodeSelectionValues(node, behavior);
    if(controlledValues.length===0) { return 'none'; }
    const selectedCount=controlledValues.reduce(
        (count, value) => count+(selectedFilterValues.has(value)? 1:0),
        0
    );
    if(selectedCount===0) { return 'none'; }
    if(selectedCount===controlledValues.length) { return 'all'; }
    return 'some';
}

/** Toggle the values controlled by one node without changing unrelated values. */
export function toggleNodeSelection(
    node: NormalizedTreeNode,
    selectedFilterValues: ReadonlySet<string>,
    behavior=SelectionBehavior.TERMINAL
): Set<string> {
    const controlledValues=getNodeSelectionValues(node, behavior);
    const next=new Set(selectedFilterValues);
    const deselect=getSelectionState(node, selectedFilterValues, behavior)==='all';
    controlledValues.forEach(value => {
        if(deselect) { next.delete(value); }
        else { next.add(value); }
    });
    return next;
}

/** Toggle one expanded tree path while preserving all other open paths. */
export function toggleOpenNode(openNodeKeys: readonly string[], key: string): string[] {
    return openNodeKeys.includes(key)?
        openNodeKeys.filter(openNodeKey => openNodeKey!==key):
        openNodeKeys.concat(key);
}

/** Return the complete selectable value universe for one behavior. */
export function getAllSelectableFilterValues(
    nodes: readonly NormalizedTreeNode[],
    behavior=SelectionBehavior.TERMINAL
): string[] {
    const property=behavior===SelectionBehavior.TERMINAL?'terminalFilterValues':'subtreeFilterValues';
    return unique(nodes.reduce<string[]>((values, node) => values.concat(node[property]), []));
}

function isTableauCell(cell: HierarchyCell): cell is TableauCellLike {
    // Tableau's current Extensions API exposes DataValue fields through class
    // getters, so they live on the prototype rather than as own properties.
    return typeof cell==='object'&&cell!==null&&(
        'value' in cell||'nativeValue' in cell||'formattedValue' in cell
    );
}

function encodeKeyPart(value: string): string {
    return encodeURIComponent(value).replace(/'/g, '%27');
}

function finalizeFlatNodes(nodes: Map<string, FlatNodeBuilder>): NormalizedTreeNode[] {
    const normalized=Array.from(nodes.values()).map(node => {
        const children=finalizeFlatNodes(node.children);
        const directFilterValues=Array.from(node.directFilterValues);
        const terminalFilterValues=children.length===0?
            directFilterValues.slice():
            unique(children.reduce<string[]>((values, child) => values.concat(child.terminalFilterValues), []));
        const subtreeFilterValues=unique(directFilterValues.concat(
            children.reduce<string[]>((values, child) => values.concat(child.subtreeFilterValues), [])
        ));
        return {
            directFilterValues,
            hierarchyValue: node.hierarchyValue,
            key: node.key,
            label: node.label,
            nodes: children,
            sourceLevels: node.sourceLevels,
            sourcePathValues: node.sourcePathValues,
            subtreeFilterValues,
            terminalFilterValues
        };
    });
    return sortTree(normalized);
}

function buildRecursiveNode(
    record: RecursiveRecord,
    childrenByParent: Map<string, RecursiveRecord[]>,
    built: Set<string>,
    ancestors: Set<string>
): NormalizedTreeNode {
    built.add(record.id);
    const nextAncestors=new Set(ancestors);
    nextAncestors.add(record.id);
    const children=(childrenByParent.get(record.id)||[])
        .filter(child => !nextAncestors.has(child.id))
        .map(child => buildRecursiveNode(child, childrenByParent, built, nextAncestors));
    const directFilterValues=[record.id];
    const terminalFilterValues=children.length===0?
        directFilterValues.slice():
        unique(children.reduce<string[]>((values, child) => values.concat(child.terminalFilterValues), []));
    const subtreeFilterValues=unique(directFilterValues.concat(
        children.reduce<string[]>((values, child) => values.concat(child.subtreeFilterValues), [])
    ));
    return {
        directFilterValues,
        hierarchyValue: record.id,
        key: `recursive:${ encodeKeyPart(record.id) }`,
        label: record.label,
        nodes: sortTree(children),
        sourceLevels: [],
        sourcePathValues: [],
        subtreeFilterValues,
        terminalFilterValues
    };
}

function sortTree(nodes: NormalizedTreeNode[]): NormalizedTreeNode[] {
    nodes.sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }));
    return nodes;
}

function unique(values: string[]): string[] {
    return Array.from(new Set(values));
}
