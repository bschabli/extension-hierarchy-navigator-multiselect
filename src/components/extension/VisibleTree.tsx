import { ReactNode } from 'react';
import { NormalizedTreeNode } from './TreeModel';

export interface TreeMenuItem {
    key: string;
    label: string;
    level: number;
    hasNodes: boolean;
    isOpen: boolean;
    onClick: () => void;
}

export function flattenVisibleTree(
    nodes: readonly NormalizedTreeNode[],
    openPaths: ReadonlySet<string>,
    onClick: (item: TreeMenuItem) => void,
    parentPath='',
    level=0
): TreeMenuItem[] {
    const items: TreeMenuItem[]=[];
    for(const node of nodes) {
        const key=parentPath?`${parentPath}/${node.key}`:node.key;
        const item: TreeMenuItem={ key, label: node.label, level, hasNodes: node.nodes.length>0,
            isOpen: openPaths.has(key), onClick: () => onClick(item) };
        items.push(item);
        if(item.isOpen) { items.push(...flattenVisibleTree(node.nodes, openPaths, onClick, key, level+1)); }
    }
    return items;
}

/** Visible-row projection for the hierarchy navigator. */
export default function VisibleTree(props: {
    data: NormalizedTreeNode[];
    openNodes: string[];
    onClickItem: (item: TreeMenuItem) => void;
    children: (value: { items: TreeMenuItem[] }) => ReactNode;
}) {
    return <>{props.children({ items: flattenVisibleTree(props.data, new Set(props.openNodes), props.onClickItem) })}</>;
}
