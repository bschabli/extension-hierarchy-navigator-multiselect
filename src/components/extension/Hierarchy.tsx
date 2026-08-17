import { Button, TextField } from '@tableau/tableau-ui';
import React, { ReactFragment, useEffect, useMemo, useRef, useState } from 'react';
import TreeMenu from 'react-simple-tree-menu';
import { debugOverride, defaultSelectedProps, HierarchyProps, HierType } from '../API/Interfaces';
import {
    CheckboxState,
    NormalizedTreeNode,
    buildFlatTree,
    buildRecursiveTree,
    getSelectionState,
    toggleNodeSelection
} from './TreeModel';

export interface HierarchySelectionPayload {
    currentFieldValues?: Array<string|undefined>;
    currentId: string;
    currentLabel: string;
    currentLevel?: number;
    selectedLeafValues?: string[];
}

interface PathMap {
    hierarchyValue: string;
    label: string;
    path: string;
}

interface Props {
    currentId: string;
    currentLabel: string;
    data: HierarchyProps;
    lastUpdated: Date;
    setDataFromExtension: (data: HierarchySelectionPayload) => void;
}

interface CheckboxTreeItemProps {
    checkboxState: CheckboxState;
    closedIcon: React.ReactNode;
    disabled: boolean;
    focused?: boolean;
    hasNodes: boolean;
    isOpen: boolean;
    label: string;
    level: number;
    onClick: () => void;
    onToggleSelection: () => void;
    openedIcon: React.ReactNode;
    style: React.CSSProperties;
    toggleNode?: () => void;
}

function CheckboxTreeItem(props: CheckboxTreeItemProps) {
    const checkboxRef=useRef<HTMLInputElement>(null);
    useEffect(() => {
        if(checkboxRef.current) { checkboxRef.current.indeterminate=props.checkboxState==='some'; }
    }, [props.checkboxState]);

    return (
        <li
            className={`rstm-tree-item hierarchy-checkbox-item${ props.focused? ' rstm-tree-item--focused':'' }`}
            style={{ ...props.style, paddingLeft: `${ 0.5+props.level*1.25 }rem` }}
            role='treeitem'
            aria-expanded={props.hasNodes? props.isOpen:undefined}
        >
            <button
                className={`hierarchy-toggle${ props.hasNodes? '':' hierarchy-toggle--empty' }`}
                type='button'
                disabled={!props.hasNodes}
                aria-label={props.isOpen? 'Collapse node':'Expand node'}
                onClick={(event) => {
                    event.stopPropagation();
                    if(props.hasNodes&&props.toggleNode) { props.toggleNode(); }
                }}
            >
                {props.hasNodes? (props.isOpen? props.openedIcon:props.closedIcon):null}
            </button>
            <input
                ref={checkboxRef}
                type='checkbox'
                checked={props.checkboxState==='all'}
                disabled={props.disabled}
                aria-label={`Select ${ props.label }`}
                onChange={props.onToggleSelection}
            />
            <button className='hierarchy-node-label' type='button' onClick={props.onClick}>
                {props.label}
            </button>
        </li>
    );
}

function Hierarchy(props: Props) {
    const { debug=false||debugOverride }=props.data.options;
    const childRef=useRef<any>(null);
    const selectedRef=useRef<Set<string>>(new Set<string>());
    const [selectedLeafValues, setSelectedLeafValues]=useState<Set<string>>(new Set<string>());
    const [currentLabel, setCurrentLabel]=useState(props.currentLabel);
    const [currentId, setCurrentId]=useState(props.currentId);
    const [pathMap, setPathMap]=useState<PathMap[]>([]);
    const [tree, setTree]=useState<NormalizedTreeNode[]>([]);
    const [searchVal, setSearchVal]=useState('');

    const defaultClosedIcon=<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'>
        <path fill={props.data.options.fontColor} fillRule='evenodd' d='M12.7632424,18.2911068 L24.112,6.942 L22.698,5.528 L12.0561356,16.1697864 L1.414,5.528 L8.52651283e-14,6.942 L11.3490288,18.2911068 C11.7395531,18.6816311 12.3727181,18.6816311 12.7632424,18.2911068 Z' transform='matrix(0 1 1 0 0 0)' />
    </svg>;
    const defaultOpenedIcon=<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'>
        <path fill={props.data.options.fontColor} fillRule='evenodd' d='M12.7632424,17.6209712 L24.112,6.27186438 L22.698,4.85786438 L12.0561356,15.4996508 L1.414,4.85786438 L4.08562073e-14,6.27186438 L11.3490288,17.6209712 C11.7395531,18.0114954 12.3727181,18.0114954 12.7632424,17.6209712 Z' />
    </svg>;
    const [openedIcon, setOpenedIcon]=useState<any>(defaultOpenedIcon);
    const [closedIcon, setClosedIcon]=useState<any>(defaultClosedIcon);

    const nodeById=useMemo(() => {
        const result=new Map<string, NormalizedTreeNode>();
        function addNodes(nodes: NormalizedTreeNode[]): void {
            nodes.forEach(node => {
                result.set(node.key, node);
                addNodes(node.nodes);
            });
        }
        addNodes(tree);
        return result;
    }, [tree]);

    useEffect(() => {
        if(props.data.options.openedIconType==='Default') { setOpenedIcon(defaultOpenedIcon); }
        else if(props.data.options.openedIconType==='Base64 Image') {
            setOpenedIcon(<img src={props.data.options.openedIconBase64Image} width='12px' height='12px' alt='Expanded' />);
        }
        else { setOpenedIcon(props.data.options.openedIconAscii); }

        if(props.data.options.closedIconType==='Default') { setClosedIcon(defaultClosedIcon); }
        else if(props.data.options.closedIconType==='Base64 Image') {
            setClosedIcon(<img src={props.data.options.closedIconBase64Image} width='12px' height='12px' alt='Collapsed' />);
        }
        else { setClosedIcon(props.data.options.closedIconAscii); }
    }, [
        props.data.options.openedIconType,
        props.data.options.openedIconBase64Image,
        props.data.options.openedIconAscii,
        props.data.options.closedIconType,
        props.data.options.closedIconBase64Image,
        props.data.options.closedIconAscii,
        props.data.options.fontColor
    ]);

    useEffect(() => {
        if(props.currentId!==currentId&&props.data.configComplete) { selectNodeFromDashboard('id', props.currentId); }
    }, [props.currentId]);

    useEffect(() => {
        if(props.currentLabel!==currentLabel&&props.data.configComplete) { selectNodeFromDashboard('label', props.currentLabel); }
    }, [props.currentLabel]);

    useEffect(() => {
        clearHierarchy();
        if(props.data.configComplete) { loadHierarchyFromDataSource(); }
    }, [props.lastUpdated]);

    async function loadHierarchyFromDataSource(): Promise<void> {
        const worksheet=window.tableau.extensions.dashboardContent!.dashboard.worksheets.find(
            (candidate: any) => candidate.name===props.data.worksheet.name
        );
        if(typeof worksheet==='undefined') { return; }
        const dataTable: any=await worksheet.getSummaryDataAsync();
        const columnIndexes=new Map<string, number>();
        dataTable.columns.forEach((column: any) => columnIndexes.set(column.fieldName, column.index));

        let nextTree: NormalizedTreeNode[]=[];
        if(props.data.type===HierType.FLAT) {
            const levelIndexes=props.data.worksheet.fields.map(field => columnIndexes.get(field));
            const idIndex=columnIndexes.get(props.data.worksheet.childId);
            if(levelIndexes.every(index => typeof index==='number')&&typeof idIndex==='number') {
                nextTree=buildFlatTree(dataTable.data, levelIndexes as number[], idIndex, props.data.separator);
            }
        }
        else {
            const parentIndex=columnIndexes.get(props.data.worksheet.parentId);
            const idIndex=columnIndexes.get(props.data.worksheet.childId);
            const labelIndex=columnIndexes.get(props.data.worksheet.childLabel);
            if(typeof parentIndex==='number'&&typeof idIndex==='number'&&typeof labelIndex==='number') {
                nextTree=buildRecursiveTree(dataTable.data, parentIndex, idIndex, labelIndex);
            }
        }

        const nextPathMap=buildPathMap(nextTree);
        setTree(nextTree);
        setPathMap(nextPathMap);
        if(debug) { console.log('Normalized hierarchy:', nextTree); }
        if(nextTree.length>0) { setActiveNode(nextTree[0], false); }
    }

    function clearHierarchy(): void {
        selectedRef.current=new Set<string>();
        setSelectedLeafValues(new Set<string>());
        setTree([]);
        setPathMap([]);
    }

    function buildPathMap(nodes: NormalizedTreeNode[], parentPath=''): PathMap[] {
        return nodes.reduce<PathMap[]>((result, node) => {
            const path=parentPath===''? node.key:`${ parentPath }/${ node.key }`;
            result.push({ hierarchyValue: node.hierarchyValue, label: node.label, path });
            return result.concat(buildPathMap(node.nodes, path));
        }, []);
    }

    function toggleSelection(node: NormalizedTreeNode): void {
        if(node.leafFilterValues.length===0) { return; }
        const next=toggleNodeSelection(node, selectedRef.current);
        selectedRef.current=next;
        setSelectedLeafValues(next);
        setActiveNode(node, true, next);
    }

    function setActiveNode(node: NormalizedTreeNode, includeSelection: boolean, selection=selectedRef.current): void {
        setCurrentId(node.hierarchyValue);
        setCurrentLabel(node.label);
        props.setDataFromExtension({
            currentFieldValues: node.sourcePathValues,
            currentId: node.hierarchyValue,
            currentLabel: node.label,
            currentLevel: node.sourceLevels.length? node.sourceLevels[0]+1:undefined,
            selectedLeafValues: includeSelection? Array.from(selection):undefined
        });
    }

    function selectNodeFromDashboard(type: 'id'|'label', value: string): void {
        const match=pathMap.find(node => type==='id'? node.hierarchyValue===value:node.label===value);
        if(typeof match==='undefined') { return; }
        const openNodes=makePath(match.path);
        if(childRef.current) { childRef.current.resetOpenNodes(openNodes, match.path); }
        setCurrentId(match.hierarchyValue);
        setCurrentLabel(match.label);
        props.setDataFromExtension({ currentId: match.hierarchyValue, currentLabel: match.label });
    }

    function makePath(path: string): string[] {
        const keys=path.split('/');
        const result: string[]=[];
        for(let index=0;index<keys.length-1;index++) {
            result.push(index===0? keys[index]:`${ result[index-1] }/${ keys[index] }`);
        }
        return result;
    }

    function resetAll(): void {
        const emptySelection=new Set<string>();
        selectedRef.current=emptySelection;
        setSelectedLeafValues(emptySelection);
        props.setDataFromExtension({
            currentId,
            currentLabel,
            selectedLeafValues: []
        });
    }

    const debugState: ReactFragment=debug? (
        <div style={{ position: 'relative', top: 0, marginTop: '10px' }}>
            Debug: true<p />
            State: {`id:${ currentId } label:${ currentLabel } selected:${ selectedLeafValues.size }`}<p />
        </div>
    ):(<div />);
    const searchStyle: React.CSSProperties=props.data.options.searchEnabled? {
        width: '100%',
        color: props.data.options.fontColor,
        borderColor: props.data.options.fontColor,
        '--placeholderColor': props.data.options.fontColor||defaultSelectedProps.options.fontColor,
        backgroundColor: 'inherit',
        border: '1px solid #cbcbcb',
        borderRadius: '1px',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
        fontSize: 'inherit',
        height: '24px',
        paddingLeft: '27px',
        display: 'flex'
    } as React.CSSProperties:{ display: 'none' };

    return (
        <div style={{ width: '100%' }}>
            <div className='hierarchy-toolbar'>
                {props.data.options.titleEnabled&&<span style={{ fontWeight: 'bold' }}>{props.data.options.title}</span>}
                <Button
                    kind='outline'
                    onClick={resetAll}
                    disabled={selectedLeafValues.size===0}
                    aria-label='Reset all hierarchy selections'
                >Reset Selections</Button>
            </div>
            <TreeMenu
                data={tree}
                onClickItem={(item: any) => {
                    const nodeId=item.key.split('/').pop()||'';
                    const node=nodeById.get(nodeId);
                    if(node) { toggleSelection(node); }
                }}
                resetOpenNodesOnDataUpdate={true}
                ref={childRef}
                debounceTime={125}
            >
                {({ search, items }) => (
                    <>
                        <TextField
                            kind='search'
                            className='fullWidth'
                            style={searchStyle}
                            placeholder='Type and search'
                            value={searchVal}
                            onChange={(event: any) => {
                                setSearchVal(event.target.value);
                                if(search) { search(event.target.value); }
                            }}
                            onClear={() => {
                                if(search) { search(''); }
                                setSearchVal('');
                            }}
                        />
                        <ul className='rstm-tree-item-group' role='tree'>
                            {items.map((item: any) => {
                                const nodeId=item.key.split('/').pop()||'';
                                const node=nodeById.get(nodeId);
                                if(!node) { return null; }
                                return (
                                    <CheckboxTreeItem
                                        key={item.key}
                                        {...item}
                                        checkboxState={getSelectionState(node, selectedLeafValues)}
                                        disabled={node.leafFilterValues.length===0}
                                        onToggleSelection={() => toggleSelection(node)}
                                        openedIcon={openedIcon}
                                        closedIcon={closedIcon}
                                        style={props.data.options.itemCSS}
                                    />
                                );
                            })}
                        </ul>
                    </>
                )}
            </TreeMenu>
            {debugState}
        </div>
    );
}

export default Hierarchy;
