import React, { useEffect, useMemo, useRef, useState } from 'react';
import TreeMenu, { TreeMenuItem } from 'react-simple-tree-menu';
import { defaultSelectedProps, HierarchyProps, HierType, isDebugEnabled } from '../API/Interfaces';
import { SelectionBehavior } from '../API/SelectionBehavior';
import { loadSummaryDataset, resolveSummaryColumnIndexes } from '../API/SummaryData';
import { HighlightedHierarchyLabel } from '../shared/HighlightedHierarchyLabel';
import { useTranslation } from '../localization/I18n';
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
import { normalizeItemCss } from '../API/ConfigurationModel';
import { Button, TextField } from '../shared/UiComponents';
import {
    HierarchyFilterValueRecord,
    buildHierarchyFilterValueRecords
} from './FilterTargetValues';
import {
    HierarchyDatasetSnapshot,
    createHierarchyDatasetSnapshot,
    hierarchyDatasetSnapshotsEqual,
    reconcileNormalizedTree
} from './IncrementalTreeModel';
import { getVirtualWindow, quantizeScrollOffset } from './VirtualizationModel';
import { HierarchyLoadDiagnostics } from './DiagnosticsModel';
import {
    collapseHierarchyLevel,
    expandHierarchyLevel,
    filterHierarchyToSelection,
    getHierarchyBreadcrumbs,
    getHierarchyLevelCount,
    getHierarchyLevelSelectionValues,
    getHierarchyNavigationEntries,
    revealHierarchyPath,
    updateHierarchyLevelSelection
} from './NavigationModel';

export interface HierarchySelectionPayload {
    currentFieldValues?: Array<string|undefined>;
    currentId: string;
    currentLabel: string;
    currentLevel?: number;
    selectedFilterValues?: HierarchyFilterValueRecord[];
    selectedLeafValues?: string[];
}

interface PathMap {
    hierarchyValue: string;
    key: string;
    label: string;
    path: string;
}

interface Props {
    currentId: string;
    currentLabel: string;
    data: HierarchyProps;
    reapplySelectionsVersion: number;
    refreshVersion: number;
    onDiagnosticsChange: (diagnostics: HierarchyLoadDiagnostics) => void;
    onVirtualizationChange: (active: boolean) => void;
    setDataFromExtension: (data: HierarchySelectionPayload) => void;
}

const VIRTUALIZATION_THRESHOLD=250;
const DEFAULT_VIRTUAL_ROW_HEIGHT=32;
const COMPACT_VIRTUAL_ROW_HEIGHT=26;
const VIRTUAL_OVERSCAN=8;
const RECENT_SELECTION_LIMIT=6;

interface CheckboxTreeItemProps {
    checkboxState: CheckboxState;
    closedIcon: React.ReactNode;
    disabled: boolean;
    hasNodes: boolean;
    isOpen: boolean;
    itemKey: string;
    label: string;
    level: number;
    onClick: React.MouseEventHandler<HTMLLIElement>;
    onFocus: () => void;
    onKeyDown: (event: React.KeyboardEvent<HTMLLIElement>) => void;
    openedIcon: React.ReactNode;
    setRef: (element: HTMLLIElement|null) => void;
    style: React.CSSProperties;
    searchTerm: string;
    setSize?: number;
    positionInSet?: number;
    resultCount: number;
    tabIndex: number;
    toggleNode?: () => void;
    toggleDisabled: boolean;
}

function CheckboxTreeItem(props: CheckboxTreeItemProps) {
    const {t}=useTranslation();
    const selectionDescription=props.disabled?t('not selectable'):
        props.checkboxState==='all'?t('selected'):
            props.checkboxState==='some'?t('partially selected'):t('not selected');

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
            aria-checked={props.checkboxState==='some'?'mixed':props.checkboxState==='all'}
            aria-disabled={props.disabled||undefined}
            aria-selected={props.checkboxState!=='none'}
            aria-posinset={props.positionInSet}
            aria-setsize={props.setSize}
            aria-label={`${ props.label }, ${ t(
                props.resultCount===1?'{count} result':'{count} results',
                { count: props.resultCount }
            ) }, ${ selectionDescription }`}
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
            <span className='hierarchy-node-count' aria-hidden='true'>{props.resultCount}</span>
        </li>
    );
}

function Hierarchy(props: Props) {
    const {t}=useTranslation();
    const debug=isDebugEnabled(props.data.options.debug);
    const selectionBehavior=props.data.options.selectionBehavior||SelectionBehavior.TERMINAL;
    const autoExpandSearch=props.data.options.searchAutoExpand!==false;
    const compactMode=props.data.options.compactMode===true;
    const virtualRowHeight=compactMode?COMPACT_VIRTUAL_ROW_HEIGHT:DEFAULT_VIRTUAL_ROW_HEIGHT;
    const itemStyle=normalizeItemCss(props.data.options.itemCSS, defaultSelectedProps.options.itemCSS);
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
    const lastReappliedSelectionsVersionRef=useRef(0);
    const loadSequenceRef=useRef(0);
    const datasetSnapshotRef=useRef<HierarchyDatasetSnapshot>();
    const treeItemRefs=useRef<Map<string, HTMLLIElement>>(new Map());
    const treeViewportRef=useRef<HTMLDivElement|null>(null);
    const virtualItemsRef=useRef<TreeMenuItem[]>([]);
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
    const treeRef=useRef<NormalizedTreeNode[]>([]);
    const [searchVal, setSearchVal]=useState(initialUiState.searchText);
    const [openNodes, setOpenNodes]=useState<string[]>(initialUiState.openNodes);
    const [recentNodeKeys, setRecentNodeKeys]=useState<string[]>(initialUiState.recentNodeKeys);
    const [showSelectedOnly, setShowSelectedOnly]=useState(initialUiState.showSelectedOnly);
    const [selectedLevel, setSelectedLevel]=useState(0);
    const [activeNodeKey, setActiveNodeKey]=useState('');
    const [focusedTreePath, setFocusedTreePath]=useState('');
    const [screenReaderAnnouncement, setScreenReaderAnnouncement]=useState('');
    const [loadError, setLoadError]=useState('');
    const [treeScrollTop, setTreeScrollTop]=useState(0);
    const [treeViewportHeight, setTreeViewportHeight]=useState(() =>
        Math.max(160, typeof window==='undefined'?320:window.innerHeight-(compactMode?145:190))
    );
    const hierarchyDefinitionRef=useRef(hierarchyDefinitionSignature);
    const persistedUiStorageKeyRef=useRef(uiStorageKey);

    const defaultClosedIcon=<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'>
        <path fill={props.data.options.fontColor} fillRule='evenodd' d='M12.7632424,18.2911068 L24.112,6.942 L22.698,5.528 L12.0561356,16.1697864 L1.414,5.528 L8.52651283e-14,6.942 L11.3490288,18.2911068 C11.7395531,18.6816311 12.3727181,18.6816311 12.7632424,18.2911068 Z' transform='matrix(0 1 1 0 0 0)' />
    </svg>;
    const defaultOpenedIcon=<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'>
        <path fill={props.data.options.fontColor} fillRule='evenodd' d='M12.7632424,17.6209712 L24.112,6.27186438 L22.698,4.85786438 L12.0561356,15.4996508 L1.414,4.85786438 L4.08562073e-14,6.27186438 L11.3490288,17.6209712 C11.7395531,18.0114954 12.3727181,18.0114954 12.7632424,17.6209712 Z' />
    </svg>;
    const [openedIcon, setOpenedIcon]=useState<React.ReactNode>(defaultOpenedIcon);
    const [closedIcon, setClosedIcon]=useState<React.ReactNode>(defaultClosedIcon);

    const navigationEntries=useMemo(() => getHierarchyNavigationEntries(tree), [tree]);
    const nodeById=useMemo(
        () => new Map(navigationEntries.map(entry => [entry.node.key, entry.node])),
        [navigationEntries]
    );
    const pathByNodeKey=useMemo(
        () => new Map(navigationEntries.map(entry => [entry.node.key, entry.path])),
        [navigationEntries]
    );
    const hierarchyLevelCount=useMemo(() => getHierarchyLevelCount(tree), [tree]);
    const breadcrumbs=useMemo(
        () => getHierarchyBreadcrumbs(tree, activeNodeKey),
        [activeNodeKey, tree]
    );
    const recentNodes=useMemo(
        () => recentNodeKeys.map(key => nodeById.get(key)).filter(
            (node): node is NormalizedTreeNode => typeof node!=='undefined'
        ),
        [nodeById, recentNodeKeys]
    );

    const allSelectableFilterValues=useMemo(
        () => getAllSelectableFilterValues(tree, selectionBehavior),
        [selectionBehavior, tree]
    );
    const selectedOnlyTree=useMemo(
        () => showSelectedOnly?filterHierarchyToSelection(tree, selectedLeafValues, selectionBehavior):tree,
        [selectionBehavior, selectedLeafValues, showSelectedOnly, tree]
    );
    const searchResult=useMemo(
        () => getHierarchySearchResult(selectedOnlyTree, searchVal),
        [searchVal, selectedOnlyTree]
    );
    const searchActive=searchResult.normalizedTerm!=='';
    const visibleTree=searchActive?searchResult.tree:selectedOnlyTree;
    const effectiveOpenNodes=useMemo(() => {
        if(!searchActive||!autoExpandSearch) { return openNodes; }
        return Array.from(new Set(openNodes.concat(searchResult.autoExpandedPaths)));
    }, [autoExpandSearch, openNodes, searchActive, searchResult.autoExpandedPaths]);
    const visibleItemCount=useMemo(
        () => countVisibleTreeNodes(visibleTree, new Set(effectiveOpenNodes)),
        [effectiveOpenNodes, visibleTree]
    );

    useEffect(() => {
        props.onVirtualizationChange(visibleItemCount>VIRTUALIZATION_THRESHOLD);
    }, [props.onVirtualizationChange, visibleItemCount]);

    useEffect(() => {
        if(hierarchyLevelCount===0) { setSelectedLevel(0); }
        else { setSelectedLevel(level => Math.min(level, hierarchyLevelCount-1)); }
    }, [hierarchyLevelCount]);

    useEffect(() => {
        if(persistedUiStorageKeyRef.current!==uiStorageKey) {
            persistedUiStorageKeyRef.current=uiStorageKey;
            return;
        }
        saveHierarchyUiState(getSessionStorage(), uiStorageKey, {
            openNodes,
            recentNodeKeys,
            searchText: searchVal,
            selectedValues: Array.from(selectedLeafValues),
            showSelectedOnly
        });
    }, [openNodes, recentNodeKeys, searchVal, selectedLeafValues, showSelectedOnly, uiStorageKey]);

    useEffect(() => {
        if(selectionBehaviorRef.current===selectionBehavior) { return; }
        selectionBehaviorRef.current=selectionBehavior;
        selectedRef.current=new Set<string>();
        setSelectedLeafValues(new Set<string>());
        setShowSelectedOnly(false);
    }, [selectionBehavior]);

    useEffect(() => {
        if(!props.data.options.searchEnabled) { setSearchVal(''); }
    }, [props.data.options.searchEnabled]);

    useEffect(() => {
        const updateViewportHeight=(): void => {
            const viewport=treeViewportRef.current;
            setTreeViewportHeight(
                viewport?.clientHeight||Math.max(160, window.innerHeight-(compactMode?145:190))
            );
        };
        updateViewportHeight();
        window.addEventListener('resize', updateViewportHeight);
        return () => window.removeEventListener('resize', updateViewportHeight);
    }, [compactMode]);

    useEffect(() => {
        if(props.data.options.openedIconType==='Default') { setOpenedIcon(defaultOpenedIcon); }
        else if(props.data.options.openedIconType==='Base64 Image') {
            setOpenedIcon(<img src={props.data.options.openedIconBase64Image} width='12px' height='12px' alt={t('Expanded icon')} />);
        }
        else { setOpenedIcon(props.data.options.openedIconAscii); }

        if(props.data.options.closedIconType==='Default') { setClosedIcon(defaultClosedIcon); }
        else if(props.data.options.closedIconType==='Base64 Image') {
            setClosedIcon(<img src={props.data.options.closedIconBase64Image} width='12px' height='12px' alt={t('Collapsed icon')} />);
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
        setLoadError('');
        if(!preserveUiState) { resetHierarchyUiState(); }
        if(props.data.configComplete) {
            loadHierarchyFromDataSource(
                requestId,
                preserveUiState,
                props.reapplySelectionsVersion
            ).catch(error => {
                console.error('Unable to refresh the hierarchy source data.', error);
                if(requestId===loadSequenceRef.current) {
                    setLoadError(error instanceof Error?error.message:String(error));
                }
            });
        }
    }, [props.refreshVersion]);

    async function loadHierarchyFromDataSource(
        requestId: number,
        preserveUiState: boolean,
        reapplySelectionsVersion: number
    ): Promise<void> {
        const loadStartedAt=readPerformanceTime();
        const worksheet=window.tableau.extensions.dashboardContent!.dashboard.worksheets.find(
            candidate => candidate.name===props.data.worksheet.name
        );
        if(typeof worksheet==='undefined') {
            throw new Error(`Worksheet “${ props.data.worksheet.name }” is no longer available.`);
        }
        const dataTable=await loadSummaryDataset(worksheet);
        if(dataTable.limited||dataTable.rows.length<dataTable.totalRowCount) {
            throw new Error(
                `Tableau returned ${ dataTable.rows.length } of ${ dataTable.totalRowCount } hierarchy rows.`
            );
        }
        if(requestId!==loadSequenceRef.current) { return; }
        let relevantColumnIndexes: number[];
        let buildTree: () => NormalizedTreeNode[];
        if(props.data.type===HierType.FLAT) {
            const columnIndexes=resolveSummaryColumnIndexes(
                dataTable.columns,
                props.data.worksheet.fields.concat(props.data.worksheet.childId)
            );
            const idIndex=columnIndexes[columnIndexes.length-1];
            const levelIndexes=columnIndexes.slice(0, -1);
            relevantColumnIndexes=columnIndexes;
            buildTree=() => buildFlatTree(dataTable.rows, levelIndexes, idIndex, props.data.separator);
        }
        else {
            const [parentIndex, idIndex, labelIndex]=resolveSummaryColumnIndexes(dataTable.columns, [
                props.data.worksheet.parentId,
                props.data.worksheet.childId,
                props.data.worksheet.childLabel
            ]);
            relevantColumnIndexes=[parentIndex, idIndex, labelIndex];
            buildTree=() => buildRecursiveTree(dataTable.rows, parentIndex, idIndex, labelIndex);
        }

        const nextSnapshot=createHierarchyDatasetSnapshot(dataTable.rows, relevantColumnIndexes);
        const unchanged=preserveUiState&&hierarchyDatasetSnapshotsEqual(datasetSnapshotRef.current, nextSnapshot);
        const reapplyRequested=reapplySelectionsVersion>lastReappliedSelectionsVersionRef.current&&
            selectedRef.current.size>0;
        datasetSnapshotRef.current=nextSnapshot;
        if(unchanged&&!reapplyRequested) {
            lastReappliedSelectionsVersionRef.current=Math.max(
                lastReappliedSelectionsVersionRef.current,
                reapplySelectionsVersion
            );
            const currentNodeCount=countTreeNodes(treeRef.current);
            props.onDiagnosticsChange({
                loadTimeMs: Math.round(readPerformanceTime()-loadStartedAt),
                nodeCount: currentNodeCount,
                refreshMode: 'unchanged',
                reusedNodeCount: currentNodeCount,
                rowCount: dataTable.rows.length,
                virtualizationEnabled: false
            });
            return;
        }
        const rebuiltTree=unchanged?treeRef.current:buildTree();

        if(requestId!==loadSequenceRef.current) { return; }

        const previousTree=treeRef.current;
        const unchangedTree=rebuiltTree===previousTree;
        const reconciliation=unchangedTree?{
            changedNodeCount: 0,
            nodeCount: countTreeNodes(previousTree),
            reusedNodeCount: countTreeNodes(previousTree),
            tree: previousTree
        }:preserveUiState&&previousTree.length?
            reconcileNormalizedTree(previousTree, rebuiltTree):{
                changedNodeCount: countTreeNodes(rebuiltTree),
                nodeCount: countTreeNodes(rebuiltTree),
                reusedNodeCount: 0,
                tree: rebuiltTree
            };
        const nextTree=reconciliation.tree;
        const refreshMode=unchangedTree?'unchanged':
            preserveUiState&&previousTree.length?'incremental':'full';

        const nextPathMap=refreshMode==='unchanged'?pathMap:buildPathMap(nextTree);
        const previousSelectedValues=Array.from(selectedRef.current);
        const reconciledUiState=preserveUiState?reconcileHierarchyUiState(nextTree, {
            openNodes,
            recentNodeKeys,
            searchText: searchVal,
            selectedValues: previousSelectedValues,
            showSelectedOnly
        }, selectionBehavior):{
            openNodes: [],
            recentNodeKeys: [],
            searchText: '',
            selectedValues: [],
            showSelectedOnly: false
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
        setRecentNodeKeys(currentRecentNodeKeys => preserveUiState?reconcileHierarchyUiState(nextTree, {
            openNodes: [],
            recentNodeKeys: currentRecentNodeKeys,
            searchText: '',
            selectedValues: [],
            showSelectedOnly: false
        }, selectionBehavior).recentNodeKeys:[]);
        setShowSelectedOnly(current => preserveUiState&&current&&nextSelectedValues.size>0);
        setOpenNodes(currentOpenNodes => preserveUiState?reconcileHierarchyUiState(nextTree, {
            openNodes: currentOpenNodes,
            recentNodeKeys: [],
            searchText: '',
            selectedValues: [],
            showSelectedOnly: false
        }, selectionBehavior).openNodes:[]);
        if(!preserveUiState) { setSearchVal(''); }
        treeRef.current=nextTree;
        if(refreshMode!=='unchanged') {
            setTree(nextTree);
            setPathMap(nextPathMap);
        }
        const itemCount=countTreeNodes(nextTree);
        props.onDiagnosticsChange({
            loadTimeMs: Math.round(readPerformanceTime()-loadStartedAt),
            nodeCount: reconciliation.nodeCount,
            refreshMode,
            reusedNodeCount: reconciliation.reusedNodeCount,
            rowCount: dataTable.rows.length,
            virtualizationEnabled: false
        });
        setScreenReaderAnnouncement(
            t(itemCount===1?'Hierarchy updated. {count} item is available.':
                'Hierarchy updated. {count} items are available.', { count: itemCount })
        );
        if(debug) { console.log('Normalized hierarchy:', nextTree); }
        const activeNode=findNode(nextTree, node => node.hierarchyValue===currentIdRef.current)||
            findNode(nextTree, node => node.label===currentLabelRef.current);
        const nextActiveNode=activeNode||nextTree[0];
        if(nextActiveNode) {
            if(!activeNode||selectionChanged) {
                setActiveNode(nextActiveNode, selectionChanged, nextSelectedValues, nextTree);
            }
            else { setActiveNodeKey(activeNode.key); }
        }
        else if(selectionChanged) {
            props.setDataFromExtension({
                currentId: currentIdRef.current,
                currentLabel: currentLabelRef.current,
                selectedFilterValues: buildHierarchyFilterValueRecords(
                    nextTree,
                    nextSelectedValues,
                    props.data.separator
                ),
                selectedLeafValues: reconciledUiState.selectedValues
            });
        }
    }

    function resetHierarchyUiState(): void {
        selectedRef.current=new Set<string>();
        datasetSnapshotRef.current=undefined;
        setSelectedLeafValues(new Set<string>());
        treeRef.current=[];
        setTree([]);
        setPathMap([]);
        setSearchVal('');
        setOpenNodes([]);
        setRecentNodeKeys([]);
        setShowSelectedOnly(false);
        setActiveNodeKey('');
        setTreeScrollTop(0);
        if(treeViewportRef.current) { treeViewportRef.current.scrollTop=0; }
    }

    function buildPathMap(nodes: NormalizedTreeNode[], parentPath=''): PathMap[] {
        return nodes.reduce<PathMap[]>((result, node) => {
            const path=parentPath===''? node.key:`${ parentPath }/${ node.key }`;
            result.push({ hierarchyValue: node.hierarchyValue, key: node.key, label: node.label, path });
            return result.concat(buildPathMap(node.nodes, path));
        }, []);
    }

    function toggleSelection(node: NormalizedTreeNode): void {
        if(getNodeSelectionValues(node, selectionBehavior).length===0) { return; }
        const wasSelected=getSelectionState(node, selectedRef.current, selectionBehavior)==='all';
        const next=toggleNodeSelection(node, selectedRef.current, selectionBehavior);
        selectedRef.current=next;
        setSelectedLeafValues(next);
        if(!wasSelected) {
            setRecentNodeKeys(current => [node.key].concat(
                current.filter(key => key!==node.key)
            ).slice(0, RECENT_SELECTION_LIMIT));
        }
        setScreenReaderAnnouncement(
            `${ t(wasSelected?'{label} deselected.':'{label} selected.', { label: node.label }) } ${
                describeSelection(next.size)
            }`
        );
        setActiveNode(node, true, next);
    }

    function setActiveNode(
        node: NormalizedTreeNode,
        includeSelection: boolean,
        selection=selectedRef.current,
        selectionTree=tree
    ): void {
        currentIdRef.current=node.hierarchyValue;
        currentLabelRef.current=node.label;
        setActiveNodeKey(node.key);
        setCurrentId(node.hierarchyValue);
        setCurrentLabel(node.label);
        props.setDataFromExtension({
            currentFieldValues: node.sourcePathValues,
            currentId: node.hierarchyValue,
            currentLabel: node.label,
            currentLevel: node.sourceLevels.length? node.sourceLevels[0]+1:undefined,
            selectedFilterValues: includeSelection?buildHierarchyFilterValueRecords(
                selectionTree,
                selection,
                props.data.separator
            ):undefined,
            selectedLeafValues: includeSelection? Array.from(selection):undefined
        });
    }

    function selectNodeFromDashboard(type: 'id'|'label', value: string): void {
        // Preserve a parameter update that arrives before the refreshed hierarchy has loaded.
        if(type==='id') { currentIdRef.current=value; }
        else { currentLabelRef.current=value; }
        const match=pathMap.find(node => type==='id'? node.hierarchyValue===value:node.label===value);
        if(typeof match==='undefined') { return; }
        setOpenNodes(currentOpenNodes => revealHierarchyPath(currentOpenNodes, match.path));
        currentIdRef.current=match.hierarchyValue;
        currentLabelRef.current=match.label;
        setActiveNodeKey(match.key);
        setCurrentId(match.hierarchyValue);
        setCurrentLabel(match.label);
        props.setDataFromExtension({ currentId: match.hierarchyValue, currentLabel: match.label });
    }

    function navigateToNode(node: NormalizedTreeNode): void {
        const path=pathByNodeKey.get(node.key);
        if(!path) { return; }
        if(showSelectedOnly&&getSelectionState(node, selectedRef.current, selectionBehavior)==='none') {
            setShowSelectedOnly(false);
        }
        setOpenNodes(currentOpenNodes => revealHierarchyPath(currentOpenNodes, path));
        setActiveNode(node, false);
        window.requestAnimationFrame(() => focusTreeItem(path));
    }

    function expandSelectedLevel(): void {
        const nextOpenNodes=expandHierarchyLevel(tree, selectedLevel, openNodes);
        setOpenNodes(nextOpenNodes);
        setScreenReaderAnnouncement(t('Level {level} expanded.', { level: selectedLevel+1 }));
    }

    function collapseSelectedLevel(): void {
        const nextOpenNodes=collapseHierarchyLevel(tree, selectedLevel, openNodes);
        setOpenNodes(nextOpenNodes);
        setScreenReaderAnnouncement(t('Level {level} collapsed.', { level: selectedLevel+1 }));
    }

    function updateSelectedLevelSelection(select: boolean): void {
        const levelValues=getHierarchyLevelSelectionValues(tree, selectedLevel, selectionBehavior);
        const next=updateHierarchyLevelSelection(
            tree,
            selectedLevel,
            selectedRef.current,
            select,
            selectionBehavior
        );
        selectedRef.current=next;
        setSelectedLeafValues(next);
        if(next.size===0) { setShowSelectedOnly(false); }
        setScreenReaderAnnouncement(t(
            select?'Selected {count} values at level {level}.':'Cleared {count} values at level {level}.',
            { count: levelValues.length, level: selectedLevel+1 }
        ));
        props.setDataFromExtension({
            currentId: currentIdRef.current,
            currentLabel: currentLabelRef.current,
            selectedFilterValues: buildHierarchyFilterValueRecords(tree, next, props.data.separator),
            selectedLeafValues: Array.from(next)
        });
    }

    function toggleTreeNode(key: string, label: string): void {
        const willExpand=!openNodes.includes(key);
        setOpenNodes(currentOpenNodes => toggleOpenNode(currentOpenNodes, key));
        setScreenReaderAnnouncement(t(willExpand?'{label} expanded.':'{label} collapsed.', { label }));
    }

    function setTreeNodeExpanded(key: string, label: string, expanded: boolean): void {
        if(openNodes.includes(key)===expanded) { return; }
        setOpenNodes(currentOpenNodes => expanded?
            Array.from(new Set(currentOpenNodes.concat(key))):
            currentOpenNodes.filter(openKey => openKey!==key)
        );
        setScreenReaderAnnouncement(t(expanded?'{label} expanded.':'{label} collapsed.', { label }));
    }

    function focusTreeItem(key: string): void {
        setFocusedTreePath(key);
        const itemIndex=virtualItemsRef.current.findIndex(item => item.key===key);
        if(itemIndex>=0&&virtualItemsRef.current.length>VIRTUALIZATION_THRESHOLD&&treeViewportRef.current) {
            const nextScrollTop=itemIndex*virtualRowHeight;
            treeViewportRef.current.scrollTop=nextScrollTop;
            setTreeScrollTop(nextScrollTop);
        }
        window.requestAnimationFrame(() => window.requestAnimationFrame(
            () => treeItemRefs.current.get(key)?.focus()
        ));
    }

    function handleTreeItemKeyDown(
        event: React.KeyboardEvent<HTMLLIElement>,
        item: TreeMenuItem,
        items: TreeMenuItem[],
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
                setScreenReaderAnnouncement(t('{count} sibling branches expanded.', { count: action.keys.length }));
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
        setShowSelectedOnly(false);
        setScreenReaderAnnouncement(t('Selections reset. All values are shown.'));
        props.setDataFromExtension({
            currentId: currentIdRef.current,
            currentLabel: currentLabelRef.current,
            selectedFilterValues: [],
            selectedLeafValues: []
        });
    }

    function selectAll(): void {
        const nextSelection=new Set(allSelectableFilterValues);
        selectedRef.current=nextSelection;
        setSelectedLeafValues(nextSelection);
        setScreenReaderAnnouncement(t('All {count} values selected.', { count: allSelectableFilterValues.length }));
        props.setDataFromExtension({
            currentId: currentIdRef.current,
            currentLabel: currentLabelRef.current,
            selectedFilterValues: buildHierarchyFilterValueRecords(
                tree,
                nextSelection,
                props.data.separator
            ),
            selectedLeafValues: allSelectableFilterValues
        });
    }

    const allValuesSelected=useMemo(() => allSelectableFilterValues.length>0&&
        allSelectableFilterValues.length===selectedLeafValues.size&&
        allSelectableFilterValues.every(value => selectedLeafValues.has(value)),
    [allSelectableFilterValues, selectedLeafValues]);
    const selectedLevelValues=useMemo(
        () => getHierarchyLevelSelectionValues(tree, selectedLevel, selectionBehavior),
        [selectedLevel, selectionBehavior, tree]
    );
    const selectedLevelSelectedCount=useMemo(
        () => selectedLevelValues.reduce(
            (count, value) => count+(selectedLeafValues.has(value)?1:0),
            0
        ),
        [selectedLeafValues, selectedLevelValues]
    );
    const selectedLevelBranchPaths=useMemo(
        () => navigationEntries
            .filter(entry => entry.depth===selectedLevel&&entry.node.nodes.length>0)
            .map(entry => entry.path),
        [navigationEntries, selectedLevel]
    );
    const selectedLevelHasOpenBranches=useMemo(
        () => selectedLevelBranchPaths.some(branchPath =>
            openNodes.some(openPath => openPath===branchPath||openPath.startsWith(`${ branchPath }/`))
        ),
        [openNodes, selectedLevelBranchPaths]
    );

    function getLevelLabel(level: number): string {
        if(props.data.type===HierType.FLAT&&props.data.worksheet.fields[level]) {
            return props.data.worksheet.fields[level];
        }
        return t('Level {level}', { level: level+1 });
    }

    function describeSelection(count: number): string {
        if(count===0) { return t('All values are shown with no filter.'); }
        return t(count===1?'{count} value is selected.':'{count} values are selected.', { count });
    }

    const debugState: React.ReactNode=debug? (
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
        display: 'block'
    } as React.CSSProperties:{ display: 'none' };

    return (
        <div
            className={`hierarchy-root${ compactMode?' hierarchy-root--compact':'' }`}
            style={{ width: '100%' }}
        >
            <div className='hierarchy-toolbar'>
                {props.data.options.titleEnabled&&<span style={{ fontWeight: 'bold' }}>{props.data.options.title}</span>}
                <span className='hierarchy-selection-status'>
                    {selectedLeafValues.size===0?
                        t('All values shown (no filter)'):
                        t(selectedLeafValues.size===1?'{count} value selected':'{count} values selected', {
                            count: selectedLeafValues.size
                        })}
                </span>
                <div className='hierarchy-toolbar-actions'>
                    <Button
                        kind='outline'
                        onClick={selectAll}
                        disabled={allSelectableFilterValues.length===0||allValuesSelected}
                        aria-label={t('Select all hierarchy values')}
                    >{t('Select all')}</Button>
                    <Button
                        kind='outline'
                        onClick={resetAll}
                        disabled={selectedLeafValues.size===0}
                        aria-label={t('Reset all hierarchy selections')}
                    >{t('Reset Selections')}</Button>
                    <Button
                        kind='outline'
                        onClick={() => setShowSelectedOnly(current => !current)}
                        aria-pressed={showSelectedOnly}
                        aria-label={t('Show selected hierarchy items only')}
                    >{t(showSelectedOnly?'Show all':'Selected only')}</Button>
                </div>
            </div>
            {hierarchyLevelCount>0&&
                <details className='hierarchy-level-actions'>
                    <summary>{t('Level actions')}</summary>
                    <div className='hierarchy-level-actions-panel'>
                        <label>
                            <span>{t('Hierarchy level')}</span>
                            <select
                                value={selectedLevel}
                                onChange={event => setSelectedLevel(Number(event.target.value))}
                            >
                                {Array.from({ length: hierarchyLevelCount }, (_value, level) =>
                                    <option key={level} value={level}>{getLevelLabel(level)}</option>
                                )}
                            </select>
                        </label>
                        <div className='hierarchy-level-action-buttons'>
                            <Button
                                kind='outline'
                                onClick={expandSelectedLevel}
                                disabled={selectedLevelBranchPaths.length===0}
                            >{t('Expand level')}</Button>
                            <Button
                                kind='outline'
                                onClick={collapseSelectedLevel}
                                disabled={!selectedLevelHasOpenBranches}
                            >{t('Collapse level')}</Button>
                            <Button
                                kind='outline'
                                onClick={() => updateSelectedLevelSelection(true)}
                                disabled={selectedLevelValues.length===0||
                                    selectedLevelSelectedCount===selectedLevelValues.length}
                            >{t('Select level')}</Button>
                            <Button
                                kind='outline'
                                onClick={() => updateSelectedLevelSelection(false)}
                                disabled={selectedLevelSelectedCount===0}
                            >{t('Clear level')}</Button>
                        </div>
                    </div>
                </details>
            }
            {breadcrumbs.length>0&&
                <nav className='hierarchy-breadcrumbs' aria-label={t('Active item breadcrumbs')}>
                    {breadcrumbs.map((node, index) => <React.Fragment key={node.key}>
                        {index>0&&<span aria-hidden='true'>›</span>}
                        <button
                            type='button'
                            aria-current={index===breadcrumbs.length-1?'page':undefined}
                            onClick={() => navigateToNode(node)}
                        >{node.label}</button>
                    </React.Fragment>)}
                </nav>
            }
            {recentNodes.length>0&&
                <div className='hierarchy-recent-items' aria-label={t('Recently selected items')}>
                    <span>{t('Recent')}</span>
                    {recentNodes.slice(0, compactMode?3:RECENT_SELECTION_LIMIT).map(node =>
                        <button
                            key={node.key}
                            type='button'
                            aria-current={node.key===activeNodeKey?'true':undefined}
                            title={getHierarchyBreadcrumbs(tree, node.key).map(item => item.label).join(' › ')}
                            onClick={() => navigateToNode(node)}
                        >{node.label}</button>
                    )}
                </div>
            }
            <p id='hierarchy-keyboard-help' className='hierarchy-visually-hidden'>
                {t('Use Up and Down Arrow to move, Right Arrow to expand or enter a branch, Left Arrow to collapse or return to a parent, Home and End to jump, Space or Enter to select, and type letters to find an item.')}
            </p>
            {loadError&&
                <div className='extension-output-error' role='alert'>
                    <span><strong>{t('Hierarchy data could not be loaded')}</strong> {loadError}</span>
                    <button type='button' onClick={() => setLoadError('')} aria-label={t('Dismiss')}>×</button>
                </div>
            }
            <div
                className='hierarchy-visually-hidden'
                role='status'
                aria-live='polite'
                aria-atomic='true'
            >{screenReaderAnnouncement}</div>
            <TreeMenu
                data={visibleTree}
                disableKeyboard={true}
                openNodes={effectiveOpenNodes}
                hasSearch={false}
                onClickItem={item => {
                    const nodeId=item.key.split('/').pop()||'';
                    const node=nodeById.get(nodeId);
                    if(node) { toggleSelection(node); }
                }}
            >
                {({ items }) => {
                    virtualItemsRef.current=items;
                    const virtualized=items.length>VIRTUALIZATION_THRESHOLD;
                    const virtualWindow=virtualized?getVirtualWindow(
                        items.length,
                        treeScrollTop,
                        treeViewportHeight,
                        virtualRowHeight,
                        VIRTUAL_OVERSCAN
                    ):{
                        endIndex: items.length,
                        paddingBottom: 0,
                        paddingTop: 0,
                        startIndex: 0
                    };
                    const renderedItems=items.slice(virtualWindow.startIndex, virtualWindow.endIndex);
                    const currentFocusPath=renderedItems.some(candidate => candidate.key===focusedTreePath)?
                        focusedTreePath:renderedItems[0]?.key;
                    return (<>
                        <TextField
                            kind='search'
                            className='fullWidth'
                            style={searchStyle}
                            placeholder={t('Type and search')}
                            aria-label={t('Search hierarchy')}
                            aria-controls='hierarchy-tree'
                            value={searchVal}
                            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                                setSearchVal(event.target.value);
                                setTreeScrollTop(0);
                                if(treeViewportRef.current) { treeViewportRef.current.scrollTop=0; }
                            }}
                            onClear={() => {
                                setSearchVal('');
                                setTreeScrollTop(0);
                                if(treeViewportRef.current) { treeViewportRef.current.scrollTop=0; }
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
                                    t('No items match “{term}”', { term: searchVal.trim() }):
                                    `${ t(searchResult.matchCount===1?'{count} matching item':'{count} matching items', {
                                        count: searchResult.matchCount
                                    }) } · ${ t('ancestor context shown') }`}
                            </div>
                        }
                        {showSelectedOnly&&selectedLeafValues.size===0&&
                            <div className='hierarchy-empty-state' role='status'>
                                {t('No selected items to show.')}
                            </div>
                        }
                        <div
                            ref={treeViewportRef}
                            className={`hierarchy-tree-viewport${ virtualized?' hierarchy-tree-viewport--virtualized':'' }`}
                            onScroll={event => {
                                const nextScrollTop=quantizeScrollOffset(
                                    event.currentTarget.scrollTop,
                                    virtualRowHeight
                                );
                                setTreeScrollTop(current => current===nextScrollTop?current:nextScrollTop);
                            }}
                        >
                            <ul
                                id='hierarchy-tree'
                                className={`rstm-tree-item-group${ virtualized?' hierarchy-tree-list--virtualized':'' }`}
                                role='tree'
                                aria-label={t('Hierarchy navigator')}
                                aria-describedby='hierarchy-keyboard-help'
                                aria-multiselectable='true'
                                style={virtualized?{
                                    paddingBottom: virtualWindow.paddingBottom,
                                    paddingTop: virtualWindow.paddingTop
                                }:undefined}
                            >
                            {renderedItems.map((item, renderedIndex) => {
                                const nodeId=item.key.split('/').pop()||'';
                                const node=nodeById.get(nodeId);
                                if(!node) { return null; }
                                return (
                                    <CheckboxTreeItem
                                        key={item.key}
                                        itemKey={item.key}
                                        hasNodes={item.hasNodes}
                                        isOpen={item.isOpen}
                                        label={item.label}
                                        level={item.level}
                                        onClick={item.onClick}
                                        checkboxState={getSelectionState(node, selectedLeafValues, selectionBehavior)}
                                        disabled={getNodeSelectionValues(node, selectionBehavior).length===0}
                                        resultCount={getNodeSelectionValues(node, selectionBehavior).length}
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
                                        setSize={virtualized?items.length:undefined}
                                        positionInSet={virtualized?
                                            virtualWindow.startIndex+renderedIndex+1:undefined}
                                        style={virtualized?{
                                            ...itemStyle,
                                            boxSizing: 'border-box',
                                            height: virtualRowHeight
                                        }:itemStyle}
                                    />
                                );
                            })}
                            </ul>
                        </div>
                    </>);
                }}
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

function countVisibleTreeNodes(
    nodes: readonly NormalizedTreeNode[],
    openPaths: ReadonlySet<string>,
    parentPath=''
): number {
    return nodes.reduce((count, node) => {
        const path=parentPath?`${ parentPath }/${ node.key }`:node.key;
        return count+1+(openPaths.has(path)?countVisibleTreeNodes(node.nodes, openPaths, path):0);
    }, 0);
}

function readPerformanceTime(): number {
    return typeof performance!=='undefined'&&typeof performance.now==='function'?performance.now():Date.now();
}

export default Hierarchy;
