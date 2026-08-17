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
    /** All selectable Tableau filter values at or below this node. */
    leafFilterValues: string[];
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
    terminalFilterValues: Set<string>;
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
                    terminalFilterValues: new Set<string>()
                };
                siblings.set(key, node);
            }
            terminal=node;
            siblings=node.children;
        });

        const filterValue=normalizeHierarchyValue(row[filterValueColumnIndex]);
        if(terminal&&typeof filterValue!=='undefined') {
            terminal.terminalFilterValues.add(filterValue);
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

/** Return a node's derived checkbox state for the centralized leaf selection. */
export function getSelectionState(node: NormalizedTreeNode, selectedLeafValues: ReadonlySet<string>): CheckboxState {
    if(node.leafFilterValues.length===0) { return 'none'; }
    const selectedCount=node.leafFilterValues.reduce(
        (count, value) => count+(selectedLeafValues.has(value)? 1:0),
        0
    );
    if(selectedCount===0) { return 'none'; }
    if(selectedCount===node.leafFilterValues.length) { return 'all'; }
    return 'some';
}

/** Toggle all selectable values in a subtree without changing other branches. */
export function toggleNodeSelection(
    node: NormalizedTreeNode,
    selectedLeafValues: ReadonlySet<string>
): Set<string> {
    const next=new Set(selectedLeafValues);
    const deselect=getSelectionState(node, selectedLeafValues)==='all';
    node.leafFilterValues.forEach(value => {
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
        const leafFilterValues=new Set(node.terminalFilterValues);
        children.forEach(child => child.leafFilterValues.forEach(value => leafFilterValues.add(value)));
        return {
            hierarchyValue: node.hierarchyValue,
            key: node.key,
            label: node.label,
            leafFilterValues: Array.from(leafFilterValues),
            nodes: children,
            sourceLevels: node.sourceLevels,
            sourcePathValues: node.sourcePathValues
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
    const leafFilterValues=children.length===0?
        [record.id]:unique(children.reduce<string[]>((values, child) => values.concat(child.leafFilterValues), []));
    return {
        hierarchyValue: record.id,
        key: `recursive:${ encodeKeyPart(record.id) }`,
        label: record.label,
        leafFilterValues,
        nodes: sortTree(children),
        sourceLevels: [],
        sourcePathValues: []
    };
}

function sortTree(nodes: NormalizedTreeNode[]): NormalizedTreeNode[] {
    nodes.sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }));
    return nodes;
}

function unique(values: string[]): string[] {
    return Array.from(new Set(values));
}
