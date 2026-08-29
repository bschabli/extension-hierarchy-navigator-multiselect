// import * as t from '@tableau/extensions-api-types';
import { Parameter, Worksheet } from '@tableau/extensions-api-types';
import { useEffect, useReducer, useRef, useState } from 'react';
import * as React from 'react';
import { defaultSelectedProps, HierarchyProps, HierType, isDebugEnabled, SelectedParameters, Status } from './Interfaces';
import {
    FilterTarget,
    findNextFilterTargetWorksheet,
    replaceFilterTargetField,
    resolveFilterTargets,
    resolveFilterTargetsExcludingWorksheet,
    syncLegacyFilterTarget
} from './FilterTargets';
import { isSelectionBehavior, resolveSavedSelectionBehavior } from './SelectionBehavior';
import { loadSummaryColumns } from './SummaryData';
import { withHTMLSpaces } from './Utils';
import { LocalizedText, TranslationValues } from '../localization/I18n';
import {
    normalizeDebounceDelay,
    normalizeHierarchySettingsRecord,
    updateParameterSelection
} from './ConfigurationModel';

const extend=require('extend');

function describeError(error: unknown): string {
    if(error instanceof Error) { return error.message; }
    return String(error);
}

export interface HierarchyState {
    doneLoading: boolean;
    isError: boolean;
    isLoading: boolean;
    data: HierarchyProps;
    errorStr: React.ReactNode;
}
const initialData: HierarchyState={
    data: defaultSelectedProps,
    doneLoading: false,
    errorStr: '',
    isError: false,
    isLoading: false
};

const dataFetchReducer=(state: HierarchyState, action: { type: string, data?: any; }) => {
    const debug=isDebugEnabled(state.data.options.debug);
    if(debug) {
        console.log(`dataFetchReducer receivied: ${ action.type }`);
        console.log(action.data);
    }
    switch(action.type) {
        case 'FETCH_INIT':
            return {
                ...state,
                doneLoading: false,
                isError: false,
                isLoading: true,
            } as HierarchyState;
        case 'FETCH_SUCCESS':
            return {
                ...state,
                data: action.data,
                doneLoading: true,
                isError: false,
                isLoading: false,
            } as HierarchyState;
        case 'FETCH_FAILURE':
            return {
                ...state,
                doneLoading: true,
                errorStr: action.data,
                isError: true,
                isLoading: false
            } as HierarchyState;
        case 'ERROR':
            return {
                ...state,
                errorStr: state.errorStr?<>{state.errorStr}<br />{action.data}</>:action.data,
                isError: true
            };
        case 'CLEAR_ERROR':
            return {
                ...state,
                errorStr: '',
                isError: false
            };
        default:
            throw new Error(`Missing action.type ${ action.type }`);
    }
};

const hierarchyAPI=(): any => {
    const [currentWorksheetName, setCurrentWorksheetName]=useState('');
    const initAsyncLoading=useRef<boolean>(true);
    const suppressWorksheetRefresh=useRef(false);
    const worksheetRefreshSequence=useRef(0);
    const [state, dispatch]=useReducer(dataFetchReducer, initialData);
    const debug=isDebugEnabled(state.data.options.debug);

    // if we are loading, or reset the data, re-init
    const initAsync=async (_initialData: HierarchyProps=extend(true, {}, defaultSelectedProps)) => {
        initAsyncLoading.current=true;
        if(debug) { console.log(`begin initAsync`); }
        dispatch({ type: 'FETCH_INIT' });

        await window.tableau.extensions.initializeDialogAsync();
        window.dispatchEvent(new Event('hierarchy-locale-ready'));
        const _settings=loadSettings();
        if(debug) {
            console.log(`loading _settings: vvv`);
            console.log(_settings);
        }
        const _params=await getParamListFromDashboardAsync();
        _initialData.dashboardItems.parameters=_params;
        // validate settings
        // true means all good; false means some data didn't pass the logic
        // skip if current worksheet name is blank (initial load)
        if(typeof _settings.configComplete!=='undefined'&&_settings.configComplete) {
            const savedSelectionBehavior=_settings.options?.selectionBehavior;
            extend(true, _initialData, _settings);
            // Preserve the previous effective behavior for saved workbooks:
            // Flat trees included every represented endpoint, while
            // Recursive trees selected only terminal descendants.
            _initialData.options.selectionBehavior=resolveSavedSelectionBehavior(
                savedSelectionBehavior,
                _initialData.configComplete,
                _initialData.type
            );
            _initialData=await getWorksheetsFilterAndFieldsFromDashboardAsyncWithoutAssignments(_initialData);
            const { data, result, msg }=validateSettings(_initialData);
            switch(result) {
                case 'SUCCESS':
                    dispatch({ type: 'FETCH_SUCCESS', data: _initialData });
                    break;
                case 'MODIFIED':
                    dispatch({ type: 'FETCH_SUCCESS', data });
                    dispatch({ type: 'ERROR', data: msg });
                    break;
                case 'FAIL':
                    _initialData.dashboardItems.parameters=_params;
                    await getWorksheetsFilterAndFieldsFromDashboardAsyncWithAssignments(_initialData);
                    dispatch({ type: 'ERROR', data: `Configuration could not be restored.` });
                    break;
            }

        }
        else {
            await getWorksheetsFilterAndFieldsFromDashboardAsyncWithAssignments(_initialData);
        }

        if(debug) { console.log(`finished initAsync`); }
        initAsyncLoading.current=false;
    };

    // load settings from Extension
    const loadSettings=(): any => {
        const _settings=window.tableau.extensions.settings.getAll();
        let res={};
        if(debug) { console.log(`loadSettings: raw settings = ${ JSON.stringify(_settings) }`); }
        if(typeof _settings.data==='undefined') { return res; }
        try {
            res=normalizeHierarchySettingsRecord(JSON.parse(_settings.data));
        }
        catch(error) {
            console.warn('Saved hierarchy settings are invalid; starting with a fresh configuration.', error);
        }
        return res;
    };

    const changeHierType=(hierType: HierType) => {
        const changeHierTypeAsync=async () => {
            if(hierType===state.data.type) { return; }
            if(debug) { console.log(`begin resetAsync`); }
            dispatch({ type: 'FETCH_INIT' });
            const _initialData: HierarchyProps=extend(true, {}, defaultSelectedProps);
            _initialData.type=hierType;
            _initialData.dashboardItems.parameters=await getParamListFromDashboardAsync();
            await getWorksheetsFilterAndFieldsFromDashboardAsyncWithAssignments(_initialData);
        };
        changeHierTypeAsync().catch((error: any) => {
            console.error('Unable to change the hierarchy format.', error);
            dispatch({ type: 'FETCH_FAILURE', data: describeError(error) });
        });
    };

    // load initial extension and settings upon load
    useEffect(() => {
        initAsync().catch((error: any) => {
            initAsyncLoading.current=false;
            const message=describeError(error);
            console.error('Unable to initialize the configuration dialog.', error);
            dispatch({
                type: 'FETCH_FAILURE',
                data: <><LocalizedText message='Unable to initialize the configuration dialog:' /> {message}</>
            });
        });
    }, []);

    const setUpdates=(action: { type: string, data: any; }): void => {
        const payload: HierarchyProps=extend(true, {}, state.data);
        const targetFieldsFor=(worksheetName: string): string[] => {
            const targetItems=payload.dashboardItems.allWorksheetItems[worksheetName];
            return targetItems?Array.from(new Set(targetItems.fields.concat(targetItems.filters))):[];
        };
        const makeTarget=(worksheetName: string): FilterTarget|undefined => {
            const fields=targetFieldsFor(worksheetName);
            if(worksheetName===''||worksheetName===payload.worksheet.name||!fields.length) { return undefined; }
            return {
                worksheetName,
                fieldName: fields.includes(payload.worksheet.childId)?payload.worksheet.childId:fields[0]
            };
        };
        switch(action.type) {
            case 'SET_PARENT_ID_FIELD':
                {
                    // update parentId from UI
                    // if childId = new parentId then switch values
                    if(payload.worksheet.childId===action.data) {
                        payload.worksheet.childId=payload.worksheet.parentId;
                    }
                    payload.worksheet.parentId=action.data;
                    payload.configComplete=evalConfigComplete(payload);
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'SET_CHILD_ID_FIELD':
                {
                    const previousChildId=payload.worksheet.childId;
                    // update childId from UI
                    // if childId = new parentId then switch values
                    if(payload.worksheet.parentId===action.data) {
                        payload.worksheet.parentId=payload.worksheet.childId;
                    }
                    if(payload.type===HierType.FLAT) { payload.parameters.childId=`${ action.data }${ payload.paramSuffix }`; }
                    if (debug) console.log(`PARAM CHILD ID set to ${ payload.parameters.childId }`);
                    payload.worksheet.childId=action.data;
                    if(payload.worksheet.targetFilter===''||payload.worksheet.targetFilter===previousChildId) {
                        payload.worksheet.targetFilter=action.data;
                    }
                    const updatedTargets=replaceFilterTargetField(
                        resolveFilterTargetsExcludingWorksheet(payload.worksheet, payload.worksheet.name),
                        previousChildId,
                        action.data
                    );
                    syncLegacyFilterTarget(payload.worksheet, updatedTargets);
                    payload.configComplete=evalConfigComplete(payload);
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'SET_CHILD_LABEL_FIELD':
                {
                    // update parentId from UI
                    payload.worksheet.childLabel=action.data;
                    payload.configComplete=evalConfigComplete(payload);
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'SET_CHILD_ID_PARAMETER':
                {
                    const updated=updateParameterSelection(payload.parameters, 'childId', action.data);
                    payload.parameters.childId=updated.childId;
                    payload.parameters.childLabel=updated.childLabel;
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'SET_CHILD_LABEL_PARAMETER': 
                {
                    const updated=updateParameterSelection(payload.parameters, 'childLabel', action.data);
                    payload.parameters.childId=updated.childId;
                    payload.parameters.childLabel=updated.childLabel;
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'SET_BG_COLOR':
                {
                    // update background color
                    payload.options.bgColor=action.data;
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'SET_PARAM_SUFFiX':
                {
                    // update parameter suffix
                    payload.paramSuffix=action.data;
                    payload.parameters.level=`Level${ payload.paramSuffix }`;
                    payload.parameters.childId=`${ payload.worksheet.childId }${ payload.paramSuffix }`;
                    payload.parameters.fields=[];
                    for(const field of payload.worksheet.fields) {
                        payload.parameters.fields.push(`${ field }${ payload.paramSuffix }`);
                    }
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'SET_SEPARATOR':
                {
                    // update separator
                    payload.separator=action.data;
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'SET_FIELDS':
                {
                    // update fields for flat hierarchy
                    let _hasChanged=false;
                    payload.worksheet.fields=action.data;
                    if(payload.type===HierType.FLAT) {
                        payload.parameters.fields=[];
                        for(const field of payload.worksheet.fields) {
                            payload.parameters.fields.push(`${ field }${ payload.paramSuffix }`);
                        }
                        payload.dashboardItems.flatParameters=availableFlatParamList(payload.parameters, payload.dashboardItems.parameters);
                        if(!payload.dashboardItems.flatParameters.includes(payload.parameters.childLabel)||payload.parameters.childLabel==='') {
                            payload.parameters.childLabel=payload.dashboardItems.flatParameters[0]||'';
                            if(payload.parameters.childLabelEnabled) {
                                payload.parameters.childLabelEnabled=false;
                                _hasChanged=true;
                            }
                        }
                    }
                    payload.configComplete=evalConfigComplete(payload);
                    dispatch({ type: 'FETCH_SUCCESS', data: payload });
                    if(_hasChanged) {
                        dispatch({
                            type: 'ERROR',
                            data: <LocalizedText message='Please recheck your label parameter. It changed and was disabled.' />
                        });
                    };
                    return;
                }
            case 'SET_FILTER_FIELD':
                {
                    // update filter name from UI
                    payload.worksheet.filter=action.data;
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'SET_TARGET_WORKSHEET':
                {
                    const targets=resolveFilterTargetsExcludingWorksheet(payload.worksheet, payload.worksheet.name);
                    const replacement=makeTarget(action.data);
                    if(replacement) { targets[0]=replacement; }
                    syncLegacyFilterTarget(payload.worksheet, targets);
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'SET_TARGET_FILTER_FIELD':
                {
                    const targets=resolveFilterTargetsExcludingWorksheet(payload.worksheet, payload.worksheet.name);
                    if(targets[0]) { targets[0]={ ...targets[0], fieldName: action.data }; }
                    syncLegacyFilterTarget(payload.worksheet, targets);
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'ADD_FILTER_TARGET':
                {
                    const targets=resolveFilterTargetsExcludingWorksheet(payload.worksheet, payload.worksheet.name);
                    const worksheetName=action.data?.worksheetName||findNextFilterTargetWorksheet(
                        payload.dashboardItems.targetWorksheets,
                        targets,
                        name => name!==payload.worksheet.name&&targetFieldsFor(name).length>0
                    );
                    const newTarget=makeTarget(worksheetName);
                    if(newTarget) { targets.push(newTarget); }
                    syncLegacyFilterTarget(payload.worksheet, targets);
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'REMOVE_FILTER_TARGET':
                {
                    const targets=resolveFilterTargetsExcludingWorksheet(payload.worksheet, payload.worksheet.name)
                        .filter((_target, index) => index!==action.data.index);
                    syncLegacyFilterTarget(payload.worksheet, targets);
                    if(!targets.length) { payload.worksheet.filterEnabled=false; }
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'SET_FILTER_TARGET_WORKSHEET':
                {
                    const targets=resolveFilterTargetsExcludingWorksheet(payload.worksheet, payload.worksheet.name);
                    const replacement=makeTarget(action.data.worksheetName);
                    if(replacement&&targets[action.data.index]) { targets[action.data.index]=replacement; }
                    syncLegacyFilterTarget(payload.worksheet, targets);
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'SET_FILTER_TARGET_FIELD':
                {
                    const targets=resolveFilterTargetsExcludingWorksheet(payload.worksheet, payload.worksheet.name);
                    if(targets[action.data.index]) {
                        targets[action.data.index]={ ...targets[action.data.index], fieldName: action.data.fieldName };
                    }
                    syncLegacyFilterTarget(payload.worksheet, targets);
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'TOGGLE_FILTER_ENABLED':
                {
                    // update filter enabled/disabled from UI
                    payload.worksheet.filterEnabled=action.data;
                    if(action.data&&!resolveFilterTargetsExcludingWorksheet(payload.worksheet, payload.worksheet.name).length) {
                        const firstTargetWorksheet=payload.dashboardItems.targetWorksheets.find(
                            name => name!==payload.worksheet.name&&targetFieldsFor(name).length>0
                        )||'';
                        const firstTarget=makeTarget(firstTargetWorksheet);
                        syncLegacyFilterTarget(payload.worksheet, firstTarget?[firstTarget]:[]);
                    }
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'TOGGLE_MARKSELECTION_ENABLED':
                {
                    // update mark selection enabled/disabled from UI
                    payload.worksheet.enableMarkSelection=action.data;
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }

            case 'TOGGLE_ID_PARAMETER_ENABLED':
                {
                    // enable/disable id parameter
                    // if only 1 param or the same param is chosen for id + label  
                    if(payload.dashboardItems.parameters.length===1||
                        ((payload.parameters.childId===payload.parameters.childLabel)&&payload.parameters.childLabelEnabled)) {
                        payload.parameters.childLabelEnabled=false;
                    }
                    payload.parameters.childIdEnabled=action.data;
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'TOGGLE_LABEL_PARAMETER_ENABLED':
                {
                    // enable/disable label parameter
                    // if only 1 param or the same param is chosen for id + label  
                    if(payload.dashboardItems.parameters.length===1||
                        ((payload.parameters.childId===payload.parameters.childLabel)&&payload.parameters.childIdEnabled)) {
                        payload.parameters.childIdEnabled=false;
                    }
                    payload.parameters.childLabelEnabled=action.data;
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            // BEGIN OPTIONS 
            case 'SET_SELECTION_BEHAVIOR':
                {
                    if(isSelectionBehavior(action.data)) {
                        payload.options.selectionBehavior=action.data;
                    }
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'TOGGLE_SEARCH_DISPLAY':
                {
                    // enable/disable title
                    payload.options.searchEnabled=action.data;
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'TOGGLE_SEARCH_AUTO_EXPAND':
                {
                    payload.options.searchAutoExpand=action.data;
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'TOGGLE_TITLE_DISABLED':
                {
                    // enable/disable title
                    payload.options.titleEnabled=action.data;
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'SET_TITLE':
                {
                    // set title
                    payload.options.title=action.data;
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'SET_FONT_FAMILY':
                {
                    // set font family
                    payload.options.fontFamily=action.data;
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'SET_FONT_COLOR':
                {
                    // set title
                    payload.options.fontColor=action.data;
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'SET_FONT_SIZE':
                {
                    // set title
                    payload.options.fontSize=action.data;
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'SET_HIGHLIGHT_COLOR':
                {
                    // set highlight
                    payload.options.highlightColor=action.data;
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'SET_ITEM_CSS':
                {
                    // set item css
                    payload.options.itemCSS=action.data;
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'SET_OPENED_ICON_BASE64IMAGE':
                {
                    // set opened icon
                    payload.options.openedIconBase64Image=action.data;
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'SET_OPENED_ICON_ASCII':
                {
                    // set opened icon
                    payload.options.openedIconAscii=action.data;
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'SET_OPENED_ICON_TYPE':
                {
                    // set opened icon type
                    payload.options.openedIconType=action.data;
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'SET_CLOSED_ICON_BASE64IMAGE':
                {
                    // set closed icon
                    payload.options.closedIconBase64Image=action.data;
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'SET_CLOSED_ICON_ASCII':
                {
                    // set closed icon
                    payload.options.closedIconAscii=action.data;
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'SET_CLOSED_ICON_TYPE':
                {
                    // set closed icon type
                    payload.options.closedIconType=action.data;
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'TOGGLE_DEBUG':
                {
                    // update debug true/false
                    payload.options.debug=action.data;
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'SET_DEBOUNCE':
                {
                    // set debounce time
                    payload.options.debounce=normalizeDebounceDelay(action.data);
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'TOGGLE_DASHBOARD_LISTENERS':
                {
                    // set if parameters should listen for dashboard actions
                    payload.options.dashboardListenersEnabled=action.data;
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            // END OPTIONS
            case 'CLEAR_WARNING':
                {
                    // enable/disable warning
                    payload.options.warningEnabled=false;
                    return dispatch({ type: 'FETCH_SUCCESS', data: payload });
                }
            case 'CHANGE_HIER_TYPE':
                changeHierType(action.data);
                break;
            case 'CLEAR_ERROR':
                dispatch({ type: 'CLEAR_ERROR' });
                break;
            case 'SUBMIT':
                submit();
                break;
            default:
                if(debug) {
                    console.log(`No state found for ${ action.type } (action.data follows...)`);
                    console.log(action.data);
                }
        }
    };

    // this method will get the current worksheets and fields for the given worksheet.name without populating data.worksheets or data.parameters
    // it is for validating settings after getAll()
    const getWorksheetsFilterAndFieldsFromDashboardAsyncWithoutAssignments=async (_initialData: HierarchyProps): Promise<HierarchyProps> => {
        if(debug) { console.log(`getWorksheetsFilterAndFieldsFromDashboardAsyncWithoutAssignments`); }
        try {
            if(typeof window.tableau.extensions.dashboardContent==='undefined') {
                await window.tableau.extensions.initializeDialogAsync();
            }
            if(currentWorksheetName!==_initialData.worksheet.name) {
                suppressWorksheetRefresh.current=true;
                setCurrentWorksheetName(_initialData.worksheet.name);
            }
            await asyncForEach(window.tableau.extensions.dashboardContent!.dashboard.worksheets, async (worksheet: Worksheet) => {
                const fields=await getWorksheetFieldsAsync(worksheet);
                const filters=await getWorksheetFilters(worksheet);
                _initialData.dashboardItems.allWorksheetItems[worksheet.name]={ fields, filters };
                if((fields.length>0||filters.length>0)&&_initialData.dashboardItems.targetWorksheets.indexOf(worksheet.name)===-1) {
                    _initialData.dashboardItems.targetWorksheets.push(worksheet.name);
                }
                if(worksheet.name===_initialData.worksheet.name) {
                    if(debug) { console.log(`worksheet: vvv`, worksheet); }
                    _initialData.dashboardItems.allCurrentWorksheetItems={ fields, filters };
                }
                if(fields.length>=2&&_initialData.dashboardItems.worksheets.indexOf(worksheet.name)===-1) {
                    _initialData.dashboardItems.worksheets.push(worksheet.name);
                }
            });

            syncLegacyFilterTarget(_initialData.worksheet);
            if(_initialData.type===HierType.RECURSIVE) {
                if(_initialData.parameters.childId==='') {
                    _initialData.parameters.childId=_initialData.dashboardItems.parameters[0]||'';
                }
                if(_initialData.parameters.childLabel==='') {
                    _initialData.parameters.childLabel=_initialData.dashboardItems.parameters.find(
                        parameter => parameter!==_initialData.parameters.childId
                    )||'';
                }
            }
            else {
                if(_initialData.parameters.childId==='') {
                    _initialData.parameters.childId=_initialData.dashboardItems.parameters[0]||'';
                }
                _initialData.dashboardItems.flatParameters=availableFlatParamList(
                    _initialData.parameters,
                    _initialData.dashboardItems.parameters
                );
                if(_initialData.parameters.childLabel==='') {
                    _initialData.parameters.childLabel=_initialData.dashboardItems.flatParameters[0]||'';
                }
            }
            return _initialData;
        }
        finally {
            if(debug) { console.log(`finished getWorksheetsFromDashboardAsyncWithoutAssignment`); }
        }
    };

    /* when Ext loads or user selects a new worksheet:
     1. change worksheet name
     2. get current worksheet object in order to
     3. set current fields
     4. set current filters
     5. set childId and childLabel and parentId for default selections
     */
    const getWorksheetsFilterAndFieldsFromDashboardAsyncWithAssignments=async (
        _initialData?: HierarchyProps,
        requestedWorksheetName=currentWorksheetName,
        requestId?: number
    ): Promise<void> => {
        const effectiveRequestId=typeof requestId==='number'?
            requestId:++worksheetRefreshSequence.current;
        const requestIsStale=(): boolean => effectiveRequestId!==worksheetRefreshSequence.current;
        if(debug) { console.log(`getWorksheetsFilterAndFieldsFromDashboardAsyncWithAssignments`); }
        dispatch({ type: 'FETCH_INIT' });
        const sourceData=typeof _initialData==='undefined'?state.data:_initialData;
        const payload: HierarchyProps=extend(true, {}, sourceData);
        try {
            // step 1: Set worksheet name
            payload.worksheet.name=requestedWorksheetName;
            if(typeof window.tableau.extensions.dashboardContent==='undefined') { await window.tableau.extensions.initializeDialogAsync(); }
            await asyncForEach(window.tableau.extensions.dashboardContent!.dashboard.worksheets, async (worksheet: Worksheet) => {
                    if(debug) {
                        console.log(`worksheet ${ worksheet.name }: vvv`);
                        console.log(worksheet);
                    }
                    const _fields=await getWorksheetFieldsAsync(worksheet);
                    const _filters=await getWorksheetFilters(worksheet);
                    payload.dashboardItems.allWorksheetItems[worksheet.name]={ fields: _fields, filters: _filters };
                    if((_fields.length>0||_filters.length>0)&&payload.dashboardItems.targetWorksheets.indexOf(worksheet.name)===-1) {
                        payload.dashboardItems.targetWorksheets.push(worksheet.name);
                    }
                    // need at least 2 fields (parent/child or flat tree) to use this sheet.  filters are optional
                    if(_fields.length<2) {
                        if(debug) { console.log(` --- skipping ${ worksheet.name }; not enough fields`); }
                    }
                    else {
                        // if worksheets isn't in list, add it
                        if(payload.dashboardItems.worksheets.indexOf(worksheet.name)===-1) { payload.dashboardItems.worksheets.push(worksheet.name); }
                        // if name is blank, assume fresh load or reset and take 1st worksheet found
                        if(requestedWorksheetName===''&&payload.worksheet.name==='') {
                            payload.worksheet.name=worksheet.name;
                            suppressWorksheetRefresh.current=true;
                            setCurrentWorksheetName(payload.worksheet.name);
                        }
                        if(worksheet.name===payload.worksheet.name) {
                            // step 3: set current fields
                            payload.dashboardItems.allCurrentWorksheetItems={ fields: _fields, filters: _filters };

                            // step 5: set childid/childlabel/parentid; reset selected fields and disable filter
                            payload.worksheet.childId=payload.dashboardItems.allCurrentWorksheetItems.fields[1];
                            payload.worksheet.childLabel=payload.dashboardItems.allCurrentWorksheetItems.fields[0];
                            payload.worksheet.parentId=payload.dashboardItems.allCurrentWorksheetItems.fields[0];
                            payload.worksheet.filter=payload.dashboardItems.allCurrentWorksheetItems.filters[0]||'';
                            payload.worksheet.fields=[];
                            payload.worksheet.filterEnabled=false;
                        }
                    }
            });
            syncLegacyFilterTarget(
                payload.worksheet,
                resolveFilterTargetsExcludingWorksheet(payload.worksheet, payload.worksheet.name)
            );
            if(payload.type===HierType.RECURSIVE) {
                payload.parameters.childId=payload.dashboardItems.parameters[0]||'';
                payload.parameters.childLabel=sourceData.dashboardItems.parameters.find(
                    parameter => parameter!==payload.parameters.childId
                )||'';
            }
            else {
                payload.parameters.childId=`${ payload.worksheet.childId }${ payload.paramSuffix }`;
                payload.dashboardItems.flatParameters=availableFlatParamList(payload.parameters, payload.dashboardItems.parameters);
                payload.parameters.childLabel=payload.dashboardItems.flatParameters[0]||'';
            }
            payload.worksheet.status=Status.set;
            payload.configComplete=evalConfigComplete(payload);
            if(requestIsStale()) { return; }
            dispatch({ type: 'FETCH_SUCCESS', data: payload });
        }
        catch(error) {
            if(requestIsStale()) { return; }
            if(debug) { console.log(`error in getWorksheetsFromDashboardAsyncWithAssignments: ${ error }`); }
            payload.worksheet.status=Status.notpossible;
            dispatch({ type: 'FETCH_FAILURE', data: describeError(error) });
            throw error;
        }
        finally {
            if(debug) { console.log(`finished getWorksheetsFromDashboardAsyncWithAssignments`); }
        }
    };

    useEffect(() => {
        if(suppressWorksheetRefresh.current) {
            suppressWorksheetRefresh.current=false;
            return;
        }
        if(initAsyncLoading.current) { return; }
        const requestId=++worksheetRefreshSequence.current;
        getWorksheetsFilterAndFieldsFromDashboardAsyncWithAssignments(
            undefined,
            currentWorksheetName,
            requestId
        ).catch(error => console.error('Unable to refresh configuration worksheet metadata.', error));
    }, [currentWorksheetName]);

    // solve forEach with promise issue - https://codeburst.io/javascript-async-await-with-foreach-b6ba62bbf404
    const asyncForEach=async (array: any[], callback: any) => {
        for(let index=0;index<array.length;index++) {
            await callback(array[index], index, array);
        }
    };

    /* for Flat hierarchies -
    take the given inputs 
    level, childId, fields[] and available parameters
    and return a unique list of parameters that are still left for childLabel */
    const availableFlatParamList=(selectedParams: SelectedParameters, availableParameters: string[]): string[] => {
        const { level, childId, fields }=selectedParams;
        const p: string[]=[];
        if(debug) { console.log(`p param list: ${ p }`); }
        availableParameters.forEach(param => {
            if(param!==level&&param!==childId&&!fields.includes(param)) { p.push(param); }
        });
        if(debug) { console.log(`setting p: ${ p }`); }
        return p;
    };

    /*
    Get the fields for a give worksheet
    */
    const getWorksheetFieldsAsync=async (worksheet: Worksheet): Promise<string[]> => {
        if(debug) { console.log(`getWorksheetFieldAsync`); }
        const columns=await loadSummaryColumns(worksheet);
        const fields: string[]=[];
        columns.forEach(column => {
            if(column.dataType===tableau.DataType.String||column.dataType===tableau.DataType.Int) {
                fields.push(column.fieldName);
            }
        });
        return fields;
    };

    // retrieve parameters for the dashboard
    const getParamListFromDashboardAsync=async (): Promise<string[]> => {
        if(debug) {
            console.log(`begin loadParamList`);
        }
        const _params: Parameter[]=await window.tableau.extensions.dashboardContent!.dashboard.getParametersAsync();
        const params: string[]=[];
        if(debug) { console.log(`parameters found`); }
        for(const p of _params) {
            if(debug) { console.log(`${ p.name } of allowable Values ${ p.allowableValues.type } and type ${ p.dataType }`); }
            if(p.allowableValues.type===tableau.ParameterValueType.All&&(p.dataType===tableau.DataType.String||p.dataType===tableau.DataType.Int)) {
                params.push(p.name);
            }
            else { if(debug) { console.log(` --- skipping ${ p.name }`); } }
        }
        if(params.length>0) {
            // case insensitive sort
            params.sort((a, b) =>
                (a.localeCompare(b, 'en', { 'sensitivity': 'base' })));

        };
        if(debug) {
            console.log(`parameterList`);
            console.log(params);
            console.log(params.toString());
        }
        if(debug) { console.log(`finished loadParamList`); }
        return params;
    };

    const getWorksheetFilters=async (worksheet: Worksheet): Promise<string[]> => {
        const worksheetFilters=await worksheet.getFiltersAsync();
        if(debug) { console.log(`Filters!`); }
        const filters: string[]=[];
        for(const filter of worksheetFilters) {
            if(debug) { console.log(filter); }
            if(filter.filterType==='categorical') {
                filters.push(filter.fieldName);
            }
        }
        return filters;
    };

    // A Flat hierarchy needs one or more ordered level fields plus its ID field.
    const evalConfigComplete=(data: HierarchyProps): boolean => {
        if(data.worksheet.name===''||data.worksheet.childId==='') {
            return false;
        }
        if(data.type===HierType.FLAT&&data.worksheet.fields.length>=1) {
            return true;
        }
        else if(data.type===HierType.RECURSIVE&&data.worksheet.childLabel!==''&&data.worksheet.parentId!=='') {
            return true;
        }
        // all other conditions
        return false;
    };

    // Saves settings and closes configure dialog
    const submit=(): void => {
        // if the user hits Clear the parameter will not be configured so save 'configured' state from that
        const submitAsync=async () => {
            if(debug) {
                console.log(`submitting settings...
            ${JSON.stringify(state.data) }`);
            }
            const _data=extend(true, {}, state.data);
            delete _data.dashboardItems;
            window.tableau.extensions.settings.set('data', JSON.stringify(_data));
            // extensions.settings.set('worksheet', JSON.stringify(state.data.worksheet));
            // extensions.settings.set('bgColor', state.data.bgColor.toString());
            await window.tableau.extensions.settings.saveAsync();
            window.tableau.extensions.ui.closeDialog(state.data.configComplete.toString());
        };
        submitAsync().catch((error: any) => {
            console.error('Unable to save the hierarchy configuration.', error);
            dispatch({ type: 'ERROR', data: String(error?.message||error) });
        });
    };

    // big logic block to make sure existing settings are still valid
    // if any fail, reset all data
    // bLoad = are we loading fresh data?
    const validateSettings=(d: HierarchyProps): { data?: HierarchyProps, result: 'SUCCESS'|'MODIFIED'|'FAIL'; msg?: React.ReactNode; } => {
        const modifiedMessages: Array<{ message: string, values?: TranslationValues }>=[];
        if(debug) {
            console.log(`validate settings`);
            console.log(`availProps: vvv`);
            // console.log(availableProps);
            console.log(`selectedProps: vvv`);
            // console.log(selectedProps);
        }
        try {
            // does the array of available worksheets contain the selected sheet?
            if(!d.dashboardItems.worksheets.includes(d.worksheet.name)) { return { result: 'FAIL', msg: `Worksheet ${ d.worksheet.name } no longer present. Please reconfigure extension.` }; }
            if(d.dashboardItems.allCurrentWorksheetItems.fields.length<2) {
                return { result: 'FAIL', msg: `Worksheet ${ d.worksheet.name } no longer has 2+ fields required for the hierarchy. Please reconfigure extension.` };
            }

            if(d.type===HierType.RECURSIVE) {
                // Check Parent Id
                if(!d.dashboardItems.allCurrentWorksheetItems.fields.includes(d.worksheet.parentId)) {
                    modifiedMessages.push({
                        message: 'Parent ID ({field}) is no longer available.',
                        values: {field: d.worksheet.parentId}
                    });
                    d.worksheet.parentId=d.worksheet.childId===d.dashboardItems.allCurrentWorksheetItems.fields[0]? d.dashboardItems.allCurrentWorksheetItems.fields[1]:d.dashboardItems.allCurrentWorksheetItems.fields[0];
                };
                // Check Child Id
                if(!d.dashboardItems.allCurrentWorksheetItems.fields.includes(d.worksheet.childId)) {
                    modifiedMessages.push({
                        message: 'Child ID ({field}) is no longer available.',
                        values: {field: d.worksheet.childId}
                    });
                    d.worksheet.childId=d.worksheet.parentId===d.dashboardItems.allCurrentWorksheetItems.fields[0]? d.dashboardItems.allCurrentWorksheetItems.fields[1]:d.dashboardItems.allCurrentWorksheetItems.fields[0];
                };

                // Check Child Label
                if(!d.dashboardItems.allCurrentWorksheetItems.fields.includes(d.worksheet.childLabel)) {
                    modifiedMessages.push({
                        message: 'Child label ({field}) is no longer available.',
                        values: {field: d.worksheet.childLabel}
                    });
                    d.worksheet.childLabel=d.dashboardItems.allCurrentWorksheetItems.fields[0];
                };
            }

            else {
                // flat tree
                for(let i=0;i<d.worksheet.fields.length;i++) {
                    if(!d.dashboardItems.allCurrentWorksheetItems.fields.includes(d.worksheet.fields[i])) {
                        d.worksheet.fields=[];
                        modifiedMessages.push({message: 'One or more hierarchy fields have changed.'});
                        break;
                    }
                }

                // Check Child Id
                if(!d.dashboardItems.allCurrentWorksheetItems.fields.includes(d.worksheet.childId)) {
                    modifiedMessages.push({
                        message: 'ID field ({field}) is no longer available.',
                        values: {field: withHTMLSpaces(d.worksheet.childId)}
                    });
                    // is there a field that isn't used?
                    if(d.dashboardItems.allCurrentWorksheetItems.fields.length>d.worksheet.fields.length) {
                        // find first match and set it
                        for(let i=0;i<d.dashboardItems.allCurrentWorksheetItems.fields.length;i++) {
                            if(!d.worksheet.fields.includes(d.dashboardItems.allCurrentWorksheetItems.fields[i])) {
                                d.worksheet.childId=d.dashboardItems.allCurrentWorksheetItems.fields[i];
                                break;
                            }
                        }
                    }
                    else {
                        // just take the last field and set it as the id field
                        d.worksheet.childId=d.dashboardItems.allCurrentWorksheetItems.fields[
                            d.dashboardItems.allCurrentWorksheetItems.fields.length-1
                        ];
                    }
                };
            }

            // Check Child ID Param; recursive only
            if(d.type===HierType.RECURSIVE) {
                if(d.parameters.childIdEnabled&&!d.dashboardItems.parameters.includes(d.parameters.childId)) {
                    modifiedMessages.push({message: 'Child ID parameter is no longer available.'});
                    d.parameters.childIdEnabled=false;
                    d.parameters.childId=d.dashboardItems.parameters[0]||'';
                }
            }

            // Check for Child Label Param; recursive and flat
            if(d.parameters.childLabelEnabled&&!d.dashboardItems.parameters.includes(d.parameters.childLabel)) {
                modifiedMessages.push({
                    message: 'Child label parameter ({parameter}) is no longer available.',
                    values: {parameter: d.parameters.childLabel}
                });
                d.parameters.childLabelEnabled=false;
                d.parameters.childLabel=d.dashboardItems.parameters[1]||d.dashboardItems.parameters[0]||'';
            }

            // Migrate and validate all independently configurable filter targets.
            const validTargets: FilterTarget[]=[];
            for(const target of resolveFilterTargets(d.worksheet)) {
                const targetItems=d.dashboardItems.allWorksheetItems[target.worksheetName];
                const targetFields=targetItems?Array.from(new Set(targetItems.fields.concat(targetItems.filters))):[];
                if(target.worksheetName===d.worksheet.name||!targetFields.includes(target.fieldName)) {
                    modifiedMessages.push({
                        message: 'Filter target ({target}) is no longer available.',
                        values: {target: `${ target.worksheetName } · ${ target.fieldName }`}
                    });
                }
                else {
                    validTargets.push(target);
                }
            }
            syncLegacyFilterTarget(d.worksheet, validTargets);
            if(d.worksheet.filterEnabled&&!validTargets.length) { d.worksheet.filterEnabled=false; }

            if(debug) { console.log(`successfully completed validate fields`); }

        }
        catch(err) {
            console.error(`Error in validate settings`);
            console.error(err);
            const snippet: React.ReactNode=(<>
                <LocalizedText message='A critical error was encountered:' />
                <ul>
                    {modifiedMessages.map((item, index) => (
                        <li key={`${ index }-critical-error`}>
                            <LocalizedText message={item.message} values={item.values} />
                        </li>
                    ))}
                </ul>
            </>);
            return { result: 'MODIFIED', msg: snippet, data: d };
        }
        if(modifiedMessages.length) {
            const snippet: React.ReactNode=(<>
                <LocalizedText message='The following settings changed.' />
                <ul>
                    {modifiedMessages.map((item, index) => (
                        <li key={`${ index }-errors`}>
                            <LocalizedText message={item.message} values={item.values} />
                        </li>
                    ))}
                </ul>
                <LocalizedText message='Please review the configuration options.' />
            </>
            );

            return { result: 'MODIFIED', msg: snippet, data: d };
        }
        else {
            return { result: 'SUCCESS' };
        }
    };
    return [state, setCurrentWorksheetName, setUpdates];
};


export default hierarchyAPI;
