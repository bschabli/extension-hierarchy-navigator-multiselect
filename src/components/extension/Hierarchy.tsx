import { Button, TextField } from '@tableau/tableau-ui';
import React, { ReactFragment, useEffect, useMemo, useRef, useState } from 'react';
import TreeMenu from 'react-simple-tree-menu';
import { debugOverride, defaultSelectedProps, HierarchyProps, HierType } from '../API/Interfaces';
import { SelectionBehavior } from '../API/SelectionBehavior';
import { HighlightedHierarchyLabel } from '../shared/HighlightedHierarchyLabel';
import {
    CheckboxState,
    NormalizedTreeNode,
    buildFlatTree,
    buildRecursiveTree,
    getAllSelectableFilterValues,
    getNodeSelectionValues,
    getSelectionState,
    toggleOpenNode,
    toggleNodeSelection
} from './TreeModel';
import { getHierarchySearchResult } from './SearchModel';
import {
    KeyboardTreeItem,
    findTypeaheadTreeItem,
    getTreeKeyboardAction
} from './TreeKeyboardNavigation';
import {
    createHierarchyUiStorageKey,
    loadHierarchyUiState,
    reconcileHierarchyUiState,
    saveHierarchyUiState
} from './UiStateModel';

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
    reapplySelectionsVersion: number;
    refreshVersion: number;
    setDataFromExtension: (data: HierarchySelectionPayload) => void;
}

interface CheckboxTreeItemProps {
    checkboxState: CheckboxState;
    closedIcon: React.ReactNode;
    disabled: boolean;
    hasNodes: boolean;
    isOpen: boolean;
    itemKey: string;
    label: string;
    level: number;
    onClick: () => void;
    onFocus: () => void;
    onKeyDown: (event: React.KeyboardEvent<HTMLLIElement>) => void;
    openedIcon: React.ReactNode;
    setRef: (element: HTMLLIElement|null) => void;
    style: React.CSSProperties;
    searchTerm: string;
    tabIndex: number;
    toggleNode?: () => void;
    toggleDisabled: boolean;
}

function CheckboxTreeItem(props: CheckboxTreeItemProps) {
    const selectionDescription=props.disabled?'not selectable':
        props.checkboxState==='all'?'selected':props.checkboxState==='some'?'partially selected':'not selected';

    return (
        <li
            ref={props.setRef}
            className='rstm-tree-item hierarchy-checkbox-item'
            style={{ ...props.style, paddingLeft: `${ 0.5+props.level*1.25 }rem` }}
            role='treeitem'
            tabIndex={props.tabIndex}
            data-tree-key={props.itemKey}
            aria-expanded={props.hasNodes? props.isOpen:undefined}
            aria-level={props.level+1}
            aria-selected={props.checkboxState==='all'}
            aria-label={`${ props.label }, ${ selectionDescription }`}
            onClick={props.onClick}
            onFocus={props.onFocus}
            onKeyDown={props.onKeyDown}
        >
            <button
                className={`hierarchy-toggle${ props.hasNodes? '':' hierarchy-toggle--empty' }`}
                type='button'
                tabIndex={-1}
                disabled={!props.hasNodes||props.toggleDisabled}
                aria-hidden='true'
                onMouseDown={event => event.preventDefault()}
                onClick={(event) => {
                    event.stopPropagation();
                    if(props.hasNodes&&props.toggleNode) { props.toggleNode(); }
                    event.currentTarget.parentElement?.focus();
                }}
            >
                {props.hasNodes? (props.isOpen? props.openedIcon:props.closedIcon):null}
            </button>
            <span
                className={`hierarchy-checkbox-control hierarchy-checkbox-control--${ props.checkboxState }${
                    props.disabled?' hierarchy-checkbox-control--disabled':''
                }`}
                aria-hidden='true'
            >{props.checkboxState==='all'?'✓':props.checkboxState==='some'?'−':''}</span>
            <span className='hierarchy-node-label'>
                <HighlightedHierarchyLabel label={props.label} searchTerm={props.searchTerm} />
            </span>
        </li>
    );
}

function Hierarchy(props: Props) {
    const { debug=false||debugOverride }=props.data.options;
    const selectionBehavior=props.data.options.selectionBehavior||SelectionBehavior.TERMINAL;
    const autoExpandSearch=props.data.options.searchAutoExpand!==false;
    const hierarchyDefinitionSignature=JSON.stringify([
        props.data.type,
        props.data.worksheet.name,
        props.data.worksheet.parentId,
        props.data.worksheet.childId,
        props.data.worksheet.childLabel,
        props.data.worksheet.fields,
        props.data.separator,
        selectionBehavior
    ]);
    const dashboardName=window.tableau.extensions.dashboardContent?.dashboard.name||'';
    const uiStorageKey=createHierarchyUiStorageKey(
        dashboardName,
        window.tableau.extensions.dashboardObjectId,
        hierarchyDefinitionSignature
    );
    const [initialUiState]=useState(() => loadHierarchyUiState(getSessionStorage(), uiStorageKey));
    const childRef=useRef<any>(null);
    const lastReappliedSelectionsVersionRef=useRef(0);
    const loadSequenceRef=useRef(0);
    const treeItemRefs=useRef<Map<string, HTMLLIElement>>(new Map());
    const typeaheadRef=useRef({ text: '', updatedAt: 0 });
    const selectedRef=useRef<Set<string>>(new Set(initialUiState.selectedValues));
    const selectionBehaviorRef=useRef(selectionBehavior);
    const [selectedLeafValues, setSelectedLeafValues]=useState<Set<string>>(
        new Set(initialUiState.selectedValues)
    );
    const [currentLabel, setCurrentLabel]=useState(props.currentLabel);
    const [currentId, setCurrentId]=useState(props.currentId);
    const currentLabelRef=useRef(props.currentLabel);
    const currentIdRef=useRef(props.currentId);
    const [pathMap, setPathMap]=useState<PathMap[]>([]);
    const [tree, setTree]=useState<NormalizedTreeNode[]>([]);
    const [searchVal, setSearchVal]=useState(initialUiState.searchText);
    const [openNodes, setOpenNodes]=useState<string[]>(initialUiState.openNodes);
    const [focusedTreePath, setFocusedTreePath]=useState('');
    const [screenReaderAnnouncement, setScreenReaderAnnouncement]=useState('');
    const hierarchyDefinitionRef=useRef(hierarchyDefinitionSignature);

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

    const allSelectableFilterValues=useMemo(
        () => getAllSelectableFilterValues(tree, selectionBehavior),
        [selectionBehavior, tree]
    );
    const searchResult=useMemo(() => getHierarchySearchResult(tree, searchVal), [searchVal, tree]);
    const searchActive=searchResult.normalizedTerm!=='';
    const visibleTree=searchActive?searchResult.tree:tree;
    const effectiveOpenNodes=useMemo(() => {
        if(!searchActive||!autoExpandSearch) { return openNodes; }
        return Array.from(new Set(openNodes.concat(searchResult.autoExpandedPaths)));
    }, [autoExpandSearch, openNodes, searchActive, searchResult.autoExpandedPaths]);

    useEffect(() => {
        saveHierarchyUiState(getSessionStorage(), uiStorageKey, {
            openNodes,
            searchText: searchVal,
            selectedValues: Array.from(selectedLeafValues)
        });
    }, [openNodes, searchVal, selectedLeafValues, uiStorageKey]);

    useEffect(() => {
        if(selectionBehaviorRef.current===selectionBehavior) { return; }
        selectionBehaviorRef.current=selectionBehavior;
        selectedRef.current=new Set<string>();
        setSelectedLeafValues(new Set<string>());
    }, [selectionBehavior]);

    useEffect(() => {
        if(!props.data.options.searchEnabled) { setSearchVal(''); }
    }, [props.data.options.searchEnabled]);

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
        if(props.currentId!==currentIdRef.current&&props.data.configComplete) {
            selectNodeFromDashboard('id', props.currentId);
        }
    }, [props.currentId]);

    useEffect(() => {
        if(props.currentLabel!==currentLabelRef.current&&props.data.configComplete) {
            selectNodeFromDashboard('label', props.currentLabel);
        }
    }, [props.currentLabel]);

    useEffect(() => {
        if(props.refreshVersion===0) { return; }
        const preserveUiState=hierarchyDefinitionRef.current===hierarchyDefinitionSignature;
        hierarchyDefinitionRef.current=hierarchyDefinitionSignature;
        const requestId=++loadSequenceRef.current;
        if(!preserveUiState) { resetHierarchyUiState(); }
        if(props.data.configComplete) {
            loadHierarchyFromDataSource(
                requestId,
                preserveUiState,
                props.reapplySelectionsVersion
            ).catch(error => {
                console.error('Unable to refresh the hierarchy source data.', error);
            });
        }
    }, [props.refreshVersion]);

    async function loadHierarchyFromDataSource(
        requestId: number,
        preserveUiState: boolean,
        reapplySelectionsVersion: number
    ): Promise<void> {
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

        if(requestId!==loadSequenceRef.current) { return; }

        const nextPathMap=buildPathMap(nextTree);
        const previousSelectedValues=Array.from(selectedRef.current);
        const reconciledUiState=preserveUiState?reconcileHierarchyUiState(nextTree, {
            openNodes,
            searchText: searchVal,
            selectedValues: previousSelectedValues
        }, selectionBehavior):{
            openNodes: [],
            searchText: '',
            selectedValues: []
        };
        const nextSelectedValues=new Set(reconciledUiState.selectedValues);
        const shouldReapplySelections=
            reapplySelectionsVersion>lastReappliedSelectionsVersionRef.current&&nextSelectedValues.size>0;
        lastReappliedSelectionsVersionRef.current=Math.max(
            lastReappliedSelectionsVersionRef.current,
            reapplySelectionsVersion
        );
        const selectionChanged=!setsEqual(selectedRef.current, nextSelectedValues)||shouldReapplySelections;

        selectedRef.current=nextSelectedValues;
        setSelectedLeafValues(nextSelectedValues);
        setOpenNodes(currentOpenNodes => preserveUiState?reconcileHierarchyUiState(nextTree, {
            openNodes: currentOpenNodes,
            searchText: '',
            selectedValues: []
        }, selectionBehavior).openNodes:[]);
        if(!preserveUiState) { setSearchVal(''); }
        setTree(nextTree);
        setPathMap(nextPathMap);
        const itemCount=countTreeNodes(nextTree);
        setScreenReaderAnnouncement(
            `Hierarchy updated. ${ itemCount } item${ itemCount===1?' is':'s are' } available.`
        );
        if(debug) { console.log('Normalized hierarchy:', nextTree); }
        const activeNode=findNode(nextTree, node => node.hierarchyValue===currentIdRef.current)||
            findNode(nextTree, node => node.label===currentLabelRef.current);
        const nextActiveNode=activeNode||nextTree[0];
        if(nextActiveNode) {
            if(!activeNode||selectionChanged) {
                setActiveNode(nextActiveNode, selectionChanged, nextSelectedValues);
            }
        }
        else if(selectionChanged) {
            props.setDataFromExtension({
                currentId: currentIdRef.current,
                currentLabel: currentLabelRef.current,
                selectedLeafValues: reconciledUiState.selectedValues
            });
        }
    }

    function resetHierarchyUiState(): void {
        selectedRef.current=new Set<string>();
        setSelectedLeafValues(new Set<string>());
        setTree([]);
        setPathMap([]);
        setSearchVal('');
        setOpenNodes([]);
    }

    function buildPathMap(nodes: NormalizedTreeNode[], parentPath=''): PathMap[] {
        return nodes.reduce<PathMap[]>((result, node) => {
            const path=parentPath===''? node.key:`${ parentPath }/${ node.key }`;
            result.push({ hierarchyValue: node.hierarchyValue, label: node.label, path });
            return result.concat(buildPathMap(node.nodes, path));
        }, []);
    }

    function toggleSelection(node: NormalizedTreeNode): void {
        if(getNodeSelectionValues(node, selectionBehavior).length===0) { return; }
        const wasSelected=getSelectionState(node, selectedRef.current, selectionBehavior)==='all';
        const next=toggleNodeSelection(node, selectedRef.current, selectionBehavior);
        selectedRef.current=next;
        setSelectedLeafValues(next);
        setScreenReaderAnnouncement(
            `${ node.label } ${ wasSelected?'deselected':'selected' }. ${ describeSelection(next.size) }`
        );
        setActiveNode(node, true, next);
    }

    function setActiveNode(node: NormalizedTreeNode, includeSelection: boolean, selection=selectedRef.current): void {
        currentIdRef.current=node.hierarchyValue;
        currentLabelRef.current=node.label;
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
        const nextOpenNodes=makePath(match.path);
        setOpenNodes(nextOpenNodes);
        if(childRef.current) { childRef.current.resetOpenNodes(nextOpenNodes, match.path); }
        currentIdRef.current=match.hierarchyValue;
        currentLabelRef.current=match.label;
        setCurrentId(match.hierarchyValue);
        setCurrentLabel(match.label);
        props.setDataFromExtension({ currentId: match.hierarchyValue, currentLabel: match.label });
    }

    function toggleTreeNode(key: string, label: string): void {
        const willExpand=!openNodes.includes(key);
        setOpenNodes(currentOpenNodes => toggleOpenNode(currentOpenNodes, key));
        setScreenReaderAnnouncement(`${ label } ${ willExpand?'expanded':'collapsed' }.`);
    }

    function setTreeNodeExpanded(key: string, label: string, expanded: boolean): void {
        if(openNodes.includes(key)===expanded) { return; }
        setOpenNodes(currentOpenNodes => expanded?
            Array.from(new Set(currentOpenNodes.concat(key))):
            currentOpenNodes.filter(openKey => openKey!==key)
        );
        setScreenReaderAnnouncement(`${ label } ${ expanded?'expanded':'collapsed' }.`);
    }

    function focusTreeItem(key: string): void {
        setFocusedTreePath(key);
        window.requestAnimationFrame(() => treeItemRefs.current.get(key)?.focus());
    }

    function handleTreeItemKeyDown(
        event: React.KeyboardEvent<HTMLLIElement>,
        item: any,
        items: any[],
        node: NormalizedTreeNode
    ): void {
        const keyboardItems: KeyboardTreeItem[]=items.map(candidate => ({
            hasNodes: Boolean(candidate.hasNodes),
            isOpen: Boolean(candidate.isOpen),
            key: candidate.key,
            label: candidate.label
        }));
        const allowToggle=!(searchActive&&autoExpandSearch);
        const action=getTreeKeyboardAction(keyboardItems, item.key, event.key, allowToggle);
        if(action.type!=='none') {
            event.preventDefault();
            event.stopPropagation();
            if(action.type==='focus') { focusTreeItem(action.key); }
            else if(action.type==='expand') { setTreeNodeExpanded(action.key, node.label, true); }
            else if(action.type==='collapse') { setTreeNodeExpanded(action.key, node.label, false); }
            else if(action.type==='select') { toggleSelection(node); }
            else {
                setOpenNodes(currentOpenNodes => Array.from(new Set(currentOpenNodes.concat(action.keys))));
                setScreenReaderAnnouncement(`${ action.keys.length } sibling branches expanded.`);
            }
            return;
        }

        if(event.key.length!==1||event.ctrlKey||event.metaKey||event.altKey||event.key==='*') { return; }
        const now=Date.now();
        const previous=now-typeaheadRef.current.updatedAt<=700?typeaheadRef.current.text:'';
        const nextText=`${ previous }${ event.key }`;
        typeaheadRef.current={ text: nextText, updatedAt: now };
        const repeatedCharacter=Array.from(nextText.toLocaleLowerCase()).every(character =>
            character===nextText[0].toLocaleLowerCase()
        );
        const match=findTypeaheadTreeItem(keyboardItems, item.key, repeatedCharacter?event.key:nextText);
        if(match) {
            event.preventDefault();
            focusTreeItem(match);
        }
    }

    function makePath(path: string): string[] {
        const keys=path.split('/');
        const result: string[]=[];
        for(let index=0;index<keys.length-1;index++) {
            result.push(index===0? keys[index]:`${ result[index-1] }/${ keys[index] }`);
        }
        return result;
    }

    function findNode(
        nodes: readonly NormalizedTreeNode[],
        predicate: (node: NormalizedTreeNode) => boolean
    ): NormalizedTreeNode|undefined {
        for(const node of nodes) {
            if(predicate(node)) { return node; }
            const childMatch=findNode(node.nodes, predicate);
            if(childMatch) { return childMatch; }
        }
        return undefined;
    }

    function setsEqual(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
        return left.size===right.size&&Array.from(left).every(value => right.has(value));
    }

    function resetAll(): void {
        const emptySelection=new Set<string>();
        selectedRef.current=emptySelection;
        setSelectedLeafValues(emptySelection);
        setScreenReaderAnnouncement('Selections reset. All values are shown.');
        props.setDataFromExtension({
            currentId: currentIdRef.current,
            currentLabel: currentLabelRef.current,
            selectedLeafValues: []
        });
    }

    function selectAll(): void {
        const nextSelection=new Set(allSelectableFilterValues);
        selectedRef.current=nextSelection;
        setSelectedLeafValues(nextSelection);
        setScreenReaderAnnouncement(`All ${ allSelectableFilterValues.length } values selected.`);
        props.setDataFromExtension({
            currentId: currentIdRef.current,
            currentLabel: currentLabelRef.current,
            selectedLeafValues: allSelectableFilterValues
        });
    }

    const allValuesSelected=allSelectableFilterValues.length>0&&
        allSelectableFilterValues.every(value => selectedLeafValues.has(value));

    function describeSelection(count: number): string {
        return count===0?'All values are shown with no filter.':
            `${ count } value${ count===1?' is':'s are' } selected.`;
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
                <span className='hierarchy-selection-status'>
                    {selectedLeafValues.size===0?
                        'All values shown (no filter)':
                        `${ selectedLeafValues.size } value${ selectedLeafValues.size===1? '':'s' } selected`}
                </span>
                <div className='hierarchy-toolbar-actions'>
                    <Button
                        kind='outline'
                        onClick={selectAll}
                        disabled={allSelectableFilterValues.length===0||allValuesSelected}
                        aria-label='Select all hierarchy values'
                    >Select all</Button>
                    <Button
                        kind='outline'
                        onClick={resetAll}
                        disabled={selectedLeafValues.size===0}
                        aria-label='Reset all hierarchy selections'
                    >Reset Selections</Button>
                </div>
            </div>
            <p id='hierarchy-keyboard-help' className='hierarchy-visually-hidden'>
                Use Up and Down Arrow to move, Right Arrow to expand or enter a branch, Left Arrow to collapse or
                return to a parent, Home and End to jump, Space or Enter to select, and type letters to find an item.
            </p>
            <div
                className='hierarchy-visually-hidden'
                role='status'
                aria-live='polite'
                aria-atomic='true'
            >{screenReaderAnnouncement}</div>
            <TreeMenu
                data={visibleTree}
                openNodes={effectiveOpenNodes}
                hasSearch={false}
                onClickItem={(item: any) => {
                    const nodeId=item.key.split('/').pop()||'';
                    const node=nodeById.get(nodeId);
                    if(node) { toggleSelection(node); }
                }}
                resetOpenNodesOnDataUpdate={true}
                ref={childRef}
            >
                {({ items }) => (
                    <>
                        <TextField
                            kind='search'
                            className='fullWidth'
                            style={searchStyle}
                            placeholder='Type and search'
                            aria-label='Search hierarchy'
                            aria-controls='hierarchy-tree'
                            value={searchVal}
                            onChange={(event: any) => {
                                setSearchVal(event.target.value);
                            }}
                            onClear={() => {
                                setSearchVal('');
                            }}
                        />
                        {props.data.options.searchEnabled&&searchActive&&
                            <div
                                className='hierarchy-search-summary'
                                role='status'
                                aria-live='polite'
                                aria-atomic='true'
                            >
                                {searchResult.matchCount===0?
                                    `No items match “${ searchVal.trim() }”`:
                                    `${ searchResult.matchCount } matching item${ searchResult.matchCount===1?'':'s' } · ancestor context shown`}
                            </div>
                        }
                        <ul
                            id='hierarchy-tree'
                            className='rstm-tree-item-group'
                            role='tree'
                            aria-label='Hierarchy navigator'
                            aria-describedby='hierarchy-keyboard-help'
                            aria-multiselectable='true'
                        >
                            {items.map((item: any) => {
                                const nodeId=item.key.split('/').pop()||'';
                                const node=nodeById.get(nodeId);
                                if(!node) { return null; }
                                const currentFocusPath=items.some((candidate: any) => candidate.key===focusedTreePath)?
                                    focusedTreePath:items[0]?.key;
                                return (
                                    <CheckboxTreeItem
                                        key={item.key}
                                        {...item}
                                        itemKey={item.key}
                                        checkboxState={getSelectionState(node, selectedLeafValues, selectionBehavior)}
                                        disabled={getNodeSelectionValues(node, selectionBehavior).length===0}
                                        onFocus={() => setFocusedTreePath(item.key)}
                                        onKeyDown={event => handleTreeItemKeyDown(event, item, items, node)}
                                        setRef={element => {
                                            if(element) { treeItemRefs.current.set(item.key, element); }
                                            else { treeItemRefs.current.delete(item.key); }
                                        }}
                                        tabIndex={item.key===currentFocusPath?0:-1}
                                        toggleNode={() => toggleTreeNode(item.key, node.label)}
                                        toggleDisabled={searchActive&&autoExpandSearch}
                                        openedIcon={openedIcon}
                                        closedIcon={closedIcon}
                                        searchTerm={searchVal}
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

function getSessionStorage(): Storage|undefined {
    try { return window.sessionStorage; }
    catch(_error) { return undefined; }
}

function countTreeNodes(nodes: readonly NormalizedTreeNode[]): number {
    return nodes.reduce((count, node) => count+1+countTreeNodes(node.nodes), 0);
}

export default Hierarchy;
