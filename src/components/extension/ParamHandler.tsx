import { Dashboard, Parameter, Worksheet } from '@tableau/extensions-api-types';
import React, { useEffect, useRef, useState } from 'react';
import {
    FilterTarget,
    resolveFilterTargets,
    resolveFilterTargetsExcludingWorksheet,
    shouldUpdateFilterTargets,
    updateFilterTargets
} from '../API/FilterTargets';
import { HierarchyProps, HierType, isDebugEnabled } from '../API/Interfaces';
import { useTranslation } from '../localization/I18n';
import Hierarchy, { HierarchySelectionPayload } from './Hierarchy';

interface Props {
    data: HierarchyProps;
    dashboard: Dashboard;
}

interface ParameterEventHandlers {
    childId?: () => void;
    childLabel?: () => void;
}

function ParamHandler(props: Props) {
    const {t}=useTranslation();
    const [reapplySelectionsVersion, setReapplySelectionsVersion]=useState(0);
    const [refreshVersion, setRefreshVersion]=useState(0);
    const [currentId, setCurrentId]=useState<string>('');
    const [currentLabel, setCurrentLabel]=useState<string>('');
    const [dataFromExtension, setDataFromExtension]=useState<HierarchySelectionPayload>();
    const [outputError, setOutputError]=useState('');
    const filterQueue=useRef<Promise<void>>(Promise.resolve());
    const appliedFilterTargets=useRef<FilterTarget[]>([]);
    const appliedMarkTarget=useRef<FilterTarget>();
    const parameterEventHandlers=useRef<ParameterEventHandlers>({});
    const listenerSetupVersion=useRef(0);
    const configurationVersion=useRef(0);
    const currentIdRef=useRef('');
    const currentLabelRef=useRef('');
    const debug=isDebugEnabled(props.data.options.debug);


    // will be called with user selects new value in hierarchy
    // this is set by child Hierarchy component
    React.useEffect(() => {
        if(props.data.configComplete) {
            if(debug) { console.log(`SETPARAMDATAFROMEXTENSION: ${ JSON.stringify(dataFromExtension) }`); }
            if(typeof (dataFromExtension)!=='undefined') {
                const selectionConfigurationVersion=configurationVersion.current;
                filterQueue.current=filterQueue.current
                    .then(() => selectionConfigurationVersion===configurationVersion.current?
                        setParamDataFromExtension(dataFromExtension):Promise.resolve()
                    )
                    .catch(error => console.error('Unable to apply hierarchy selection.', error));
            }
        }
    }, [dataFromExtension]);

    // Reload hierarchy data after configuration changes. The Hierarchy component
    // decides whether the source definition changed or this is a refresh whose UI
    // state should be retained.
    useEffect(() => {
        const nextConfigurationVersion=++configurationVersion.current;
        let active=true;
        if(props.data.configComplete) {
            filterQueue.current=filterQueue.current
                .then(async () => {
                    if(debug) { console.log(`clearing events/filters/marks...`); }
                    await clearFilterAndMarksAsync();
                    if(debug) { console.log(`done clearing events/filters/marks...`); }
                    if(active&&nextConfigurationVersion===configurationVersion.current) {
                        setReapplySelectionsVersion(current => current+1);
                        setRefreshVersion(current => current+1);
                    }
                })
                .catch(error => console.error('Unable to reset hierarchy outputs after configuration changed.', error));
        }
        return () => { active=false; };
    }, [props.data]);

    // Refresh the source hierarchy when Tableau reports new summary data. The
    // listener is scoped to the configured source worksheet and removed whenever
    // that worksheet or dashboard instance changes.
    useEffect(() => {
        const worksheets=(props.dashboard as Dashboard|undefined)?.worksheets;
        const sourceWorksheet=worksheets?.find(worksheet => worksheet.name===props.data.worksheet.name);
        if(!sourceWorksheet||typeof sourceWorksheet.addEventListener!=='function') { return; }

        try {
            const unregister=sourceWorksheet.addEventListener(
                tableau.TableauEventType.SummaryDataChanged,
                () => {
                    setRefreshVersion(current => current+1);
                }
            );
            return () => { unregister(); };
        }
        catch(error) {
            console.warn('Unable to listen for hierarchy source refreshes.', error);
            return;
        }
    }, [props.dashboard, props.data.worksheet.name]);

    // if any of the parameters change via configure, (re)set event listeners
    useEffect(() => {
        if(props.data.configComplete) {
            setEventListeners().catch(error => console.error('Unable to configure parameter listeners.', error));
        }
        else {
            clearEventHandlers();
        }
        return clearEventHandlers;
    }, [
        props.dashboard,
        props.data.configComplete,
        props.data.options.dashboardListenersEnabled,
        props.data.parameters.childId,
        props.data.parameters.childIdEnabled,
        props.data.parameters.childLabel,
        props.data.parameters.childLabelEnabled,
        props.data.type
    ]);

    // finds the worksheet in the dashboard that matches the user selected worksheet
    // returns the worksheet
    function findWorksheet(): Worksheet|undefined {
        if(debug) { console.log(`findWorksheet: props.data.worksheet: ${ props.data.worksheet.name }`); }
        const worksheet=props.dashboard.worksheets.find(
            candidate => candidate.name===props.data.worksheet.name
        );
        if(debug&&worksheet) {
            console.log(`fW: found worksheet : ${ worksheet.name }`);
            console.log(worksheet);
        }
        if(debug&&!worksheet) { console.log(`fW: No worksheets found that match ${ props.data.worksheet.name }`); }
        return worksheet;
    }

    // find parameters, if enabled, and returns an array 
    // [childIdParam, childLabelParam] for recursive
    // OR [level, childid, childlabel, field1, field2, field3, ...] for flat
    async function findParameters() {
        if(debug) {
            console.log(`fp: parameters`);
            console.log(props.data.parameters);
        }
        const res: { childId?: Parameter, childLabel?: Parameter, level?: Parameter, fields?: Parameter[]; }={};
        if(props.data.worksheet.name!=='') {
            if(props.data.type===HierType.RECURSIVE) {

                // RECURSIVE
                if(props.data.parameters.childIdEnabled) {
                    res.childId=await props.dashboard.findParameterAsync(props.data.parameters.childId);
                }
                if(props.data.parameters.childLabelEnabled) {
                    res.childLabel=await props.dashboard.findParameterAsync(props.data.parameters.childLabel);
                }
            }

            else if(props.data.type===HierType.FLAT) {
                res.level=await props.dashboard.findParameterAsync(props.data.parameters.level);
                res.childId=await props.dashboard.findParameterAsync(props.data.parameters.childId);
                if(debug) {
                    console.log(`childLabel enabled (${ props.data.parameters.childLabelEnabled }) and looking for param -- ${ props.data.parameters.childLabel }`);
                }
                if(props.data.parameters.childLabelEnabled) {
                    res.childLabel=await props.dashboard.findParameterAsync(props.data.parameters.childLabel);
                    if(debug) { console.log(`found childLabel: ${ res.childLabel }`); }
                }
                res.fields=[];
                for(const param of props.data.parameters.fields) {
                    if(debug) { console.log(`looking for param ${ param }`); }
                    const p=await props.dashboard.findParameterAsync(param);
                    if(typeof p!=='undefined') { res.fields.push(p); }
                }
            }
        }
        if(debug) {
            console.log(`fP: returning...VVV`);
            console.log(res);
        }
        return res;
    }

    // sets event listeners so they can be called later and released
    async function setEventListeners() {
        const setupVersion=++listenerSetupVersion.current;
        removeEventHandlers();
        if (props.data.options.dashboardListenersEnabled){
            const { childId, childLabel }=await findParameters();
            if(setupVersion!==listenerSetupVersion.current) { return; }
            if(props.data.parameters.childIdEnabled||props.data.parameters.childLabelEnabled) {
                if(debug) { console.log(`setEventHandleListeners`); }
                if(debug) { console.log(`setting event handle listeners`); }
                if(childLabel) {
                    parameterEventHandlers.current.childLabel=childLabel.addEventListener(
                        tableau.TableauEventType.ParameterChanged,
                        () => {
                            eventDashboardChangeLabel()
                                .catch(error => console.error('Unable to process the label parameter change.', error));
                        }
                    );
                }
                if(childId) {
                    parameterEventHandlers.current.childId=childId.addEventListener(
                        tableau.TableauEventType.ParameterChanged,
                        () => {
                            eventDashboardChangeId()
                                .catch(error => console.error('Unable to process the ID parameter change.', error));
                        }
                    );
                }
                if(debug) { console.log(`done setting event handle listeners`); }
            }
            else {
                if(debug) { console.log(`skipping set event handlers because neither param is enabled.`); }
            }
        }
        else {
            if (debug) {console.log(`skipping setting event handlers because dashboardListenersEnabled: ${props.data.options.dashboardListenersEnabled}`)}
        }
    }

    // clear any event handlers that have been set
    function clearEventHandlers() {
        listenerSetupVersion.current+=1;
        removeEventHandlers();
    }

    function removeEventHandlers() {
        if(debug) { console.log(`clearing event handle listeners`); }
        if(parameterEventHandlers.current.childId) {
            parameterEventHandlers.current.childId();
            parameterEventHandlers.current.childId=undefined;
        }
        if(parameterEventHandlers.current.childLabel) {
            parameterEventHandlers.current.childLabel();
            parameterEventHandlers.current.childLabel=undefined;
        }
    }

    // clear and filter and marks
    // used when we return from the configure dialogue or the extension is loaded for the first time
    async function clearFilterAndMarksAsync() {
        if(debug) { console.log(`begin clearFilterAndMarksAsync`); }
        try {
            if(props.data.worksheet.filterEnabled||appliedFilterTargets.current.length) {
                const failedTargets: FilterTarget[]=[];
                const targets=resolveFilterTargets({
                    filterTargets: resolveFilterTargets(props.data.worksheet).concat(appliedFilterTargets.current)
                });
                await updateFilterTargets(
                    targets,
                    props.dashboard.worksheets,
                    [],
                    tableau.FilterUpdateType.Replace,
                    (target, error) => {
                        failedTargets.push(target);
                        console.error(`Unable to clear hierarchy filter '${target.fieldName}' on '${target.worksheetName}'.`, error);
                    }
                );
                appliedFilterTargets.current=failedTargets;
                setOutputError(failedTargets.length?t('Some dashboard filters could not be cleared: {targets}', {
                    targets: describeFilterTargets(failedTargets)
                }):'');
            }
            const markTarget=appliedMarkTarget.current;
            if(markTarget) {
                const worksheet=props.dashboard.worksheets.find(candidate => candidate.name===markTarget.worksheetName);
                if(worksheet) {
                    await worksheet.selectMarksByValueAsync([{
                        fieldName: markTarget.fieldName,
                        value: []
                    }], tableau.SelectionUpdateType.Replace);
                }
                appliedMarkTarget.current=undefined;
            }
        }

        catch(err) {
            console.error(err);
        }
        if(debug) { console.log(`finished clearFilterAndMarksAsync`); }
    }

    // if there is an event change on the dashboard 
    // then send the updated value to the hierarchy for evaluation
    async function eventDashboardChangeId() {
        // retrieve param so we get the latest value
        let cp: Parameter|undefined;
        if(props.data.type===HierType.RECURSIVE) { cp=await props.dashboard.findParameterAsync(props.data.parameters.childId); }
        else {
            cp=await props.dashboard.findParameterAsync(props.data.parameters.childId);
        }
        if(!cp) { return; }
        const nextId=String(cp.currentValue.value??'');
        if(nextId===currentIdRef.current) { return; }
        currentIdRef.current=nextId;
        setCurrentId(nextId);
    };
    async function eventDashboardChangeLabel() {
        const cl=await props.dashboard.findParameterAsync(props.data.parameters.childLabel);
        if(!cl) { return; }
        const nextLabel=String(cl.currentValue.value??'');
        if(nextLabel===currentLabelRef.current) { return; }
        currentLabelRef.current=nextLabel;
        setCurrentLabel(nextLabel);
    };

    async function setParamDataFromExtension(incomingData: HierarchySelectionPayload) {

        currentIdRef.current=incomingData.currentId;
        currentLabelRef.current=incomingData.currentLabel;
        setCurrentId(incomingData.currentId);
        setCurrentLabel(incomingData.currentLabel);

        function escapeRegex(value: string) {
            return value.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, '\\$&');
        }

        const { level, childId, childLabel, fields }=await (findParameters());

        try {
            if(typeof childId!=='undefined' && (props.data.parameters.childIdEnabled || props.data.type === HierType.FLAT)) {
                if(childId.dataType===tableau.DataType.Int) {
                    const converted=parseInt(incomingData.currentId, 10);
                    if(!isNaN(converted)) { await childId.changeValueAsync(converted); };
                }
                else {
                    await childId.changeValueAsync(incomingData.currentId);
                }
            }
        }
        catch(e) {
            if(debug) { console.log(`can't set childId param: ${ e.message }`); }
        }
        try {
            if(typeof childLabel!=='undefined' && props.data.parameters.childLabelEnabled) {
                if(childLabel.dataType===tableau.DataType.Int) {
                    const converted=parseInt(incomingData.currentLabel, 10);
                    if(!isNaN(converted)) { await childLabel.changeValueAsync(converted); };
                }
                else {
                    if(debug) {
                        console.log(`setting param `);
                        console.log(childLabel);
                        console.log(`to ${ incomingData.currentLabel }`);
                    }
                    await childLabel.changeValueAsync(incomingData.currentLabel);
                }
            }
        }
        catch(e) {
            if(debug) { console.log(`can't set childLabel param: ${ e.message }`); }
        }
        if(props.data.type===HierType.FLAT) {
            const currentLevel=incomingData.currentLevel||
                (incomingData.currentId.match(new RegExp(escapeRegex(props.data.separator), 'g'))?.length||0)+1;
            try {
                if(typeof level!=='undefined'&&level.dataType===tableau.DataType.Int) {
                    await level.changeValueAsync(currentLevel);
                }
            }
            catch(e) {
                if(debug) { console.log(`can't set level param: ${ e.message }`); }
            }

            const fieldVals=incomingData.currentFieldValues||incomingData.currentId.split(props.data.separator);
            if(typeof fields!=='undefined'&&fieldVals.length>0) {
                for(let i=0;i<fields.length;i++) {
                    try {
                        if(typeof fields==='undefined') { continue; }
                        if(fields[i].dataType===tableau.DataType.Int) {
                            const converted=parseInt(fieldVals[i]||'', 10);
                            if(!isNaN(converted)) { await fields[i].changeValueAsync(converted); };
                        }
                        else {
                            await fields[i].changeValueAsync(fieldVals[i]||'Null');
                        }
                    }
                    catch(e) {
                        console.error(`cannot set param for field ${ props.data.worksheet.fields[i] } (param should be ${ fields[i].name } Param) with value ${ fieldVals[i] }`);
                    }
                }
            }
        }

        if(typeof incomingData.selectedLeafValues!=='undefined') {
            const selectedValues=incomingData.selectedLeafValues;
            const configuredTargets=resolveFilterTargetsExcludingWorksheet(
                props.data.worksheet,
                props.data.worksheet.name
            );
            if(shouldUpdateFilterTargets(props.data.worksheet.filterEnabled, configuredTargets)) {
                const failedTargets: FilterTarget[]=[];
                const successfulTargets=await updateFilterTargets(
                    configuredTargets,
                    props.dashboard.worksheets,
                    selectedValues,
                    tableau.FilterUpdateType.Replace,
                    (target, error) => {
                        failedTargets.push(target);
                        console.error(`Unable to update hierarchy filter '${target.fieldName}' on '${target.worksheetName}'.`, error);
                    }
                );
                appliedFilterTargets.current=selectedValues.length?resolveFilterTargets({
                    filterTargets: successfulTargets.concat(failedTargets)
                }):failedTargets;
                setOutputError(failedTargets.length?t('Some dashboard filters could not be updated: {targets}', {
                    targets: describeFilterTargets(failedTargets)
                }):'');
            }
            if(props.data.worksheet.enableMarkSelection) {
                const worksheet=findWorksheet();
                if(worksheet) {
                    await worksheet.selectMarksByValueAsync([{
                        fieldName: props.data.worksheet.childId,
                        value: selectedValues
                    }], tableau.SelectionUpdateType.Replace);
                    appliedMarkTarget.current=selectedValues.length?{
                        worksheetName: worksheet.name,
                        fieldName: props.data.worksheet.childId
                    }:undefined;
                }
            }
        }
    }

    function describeFilterTargets(targets: FilterTarget[]): string {
        return targets.map(target => `${ target.worksheetName } · ${ target.fieldName }`).join(', ');
    }

    return (
        <>
            {outputError&&
                <div className='extension-output-error' role='alert'>
                    <span>{outputError}</span>
                    <button type='button' onClick={() => setOutputError('')} aria-label={t('Dismiss')}>×</button>
                </div>
            }
            <Hierarchy
                data={props.data}
                reapplySelectionsVersion={reapplySelectionsVersion}
                refreshVersion={refreshVersion}
                setDataFromExtension={setDataFromExtension}
                currentLabel={currentLabel}
                currentId={currentId}
            />
        </>
    );
}


export default ParamHandler;
