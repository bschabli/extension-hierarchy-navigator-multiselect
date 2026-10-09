import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Worksheet } from '@tableau/extensions-api-types';
import Hierarchy, { HierarchySelectionPayload } from '../extension/Hierarchy';
import { HierarchyLoadDiagnostics } from '../extension/DiagnosticsModel';
import { waitForTableauInitialization } from '../extension/TableauInitialization';
import { LocalizationProvider, useTranslation } from '../localization/I18n';
import { getHierarchyValue } from '../extension/TreeModel';
import { SelectionBehavior } from '../API/SelectionBehavior';
import { defaultVizPreferences, parseVizPreferences, VizBinding, VizPreferences } from './VizModel';
import { createVizRefresh, createVizSelection } from './VizRuntime';
import '../../css/style.css';
import '../../css/viz.css';

const SETTINGS_KEY='hierarchy-viz';
const noOp=(): void => undefined;
const describeError=(error: unknown): string => error instanceof Error?error.message:String(error);

export function HierarchyViz() {
    const {t}=useTranslation();
    const [binding, setBinding]=useState<VizBinding>();
    const [preferences, setPreferences]=useState<VizPreferences>(defaultVizPreferences);
    const [version, setVersion]=useState(0);
    const [externalSelection, setExternalSelection]=useState<{values: string[]; revision: number}>();
    const [error, setError]=useState('');
    const [outputError, setOutputError]=useState('');
    const [ready, setReady]=useState(false);
    const [delayed, setDelayed]=useState(false);
    const [settingsOpen, setSettingsOpen]=useState(false);
    const [diagnostics, setDiagnostics]=useState<HierarchyLoadDiagnostics>();
    const [saving, setSaving]=useState(false);
    const [authoring, setAuthoring]=useState(false);
    const worksheetRef=useRef<Worksheet>();
    const runtimeRef=useRef<ReturnType<typeof createVizRefresh>>();
    const selectionRef=useRef<ReturnType<typeof createVizSelection>>();
    const currentBinding=useRef<VizBinding>();
    const preferenceRef=useRef(preferences);
    const savedPreferences=useRef(preferences);
    const fileInput=useRef<HTMLInputElement>(null);

    useEffect(() => {
        let disposed=false;
        const listeners: Array<() => void>=[];
        window.dispatchEvent(new Event('hierarchy-app-ready'));
        const initialize=async (): Promise<void> => {
            try {
                if(!window.tableau?.extensions) { throw new Error(t('The Tableau Extensions API library did not load.')); }
                await waitForTableauInitialization(() => tableau.extensions.initializeAsync({
                    configure: () => { if(!disposed) { setSettingsOpen(true); } return {}; }
                }), () => { if(!disposed) { setDelayed(true); } });
                if(disposed) { return; }
                window.dispatchEvent(new Event('hierarchy-locale-ready'));
                const worksheet=tableau.extensions.worksheetContent?.worksheet;
                if(!worksheet) { throw new Error(t('Add this extension from the worksheet Marks card.')); }
                worksheetRef.current=worksheet;
                setAuthoring(tableau.extensions.environment.mode===tableau.ExtensionMode.Authoring);
                const readSettings=(): void => {
                    try {
                        const next=parseVizPreferences(tableau.extensions.settings.get(SETTINGS_KEY));
                        preferenceRef.current=next;
                        savedPreferences.current=next;
                        setPreferences(next);
                    }
                    catch(failure) { setOutputError(describeError(failure)); }
                };
                readSettings();
                let markRequest=0;
                const readSelection=async (): Promise<void> => {
                    const request=++markRequest;
                    const activeBinding=currentBinding.current;
                    if(!activeBinding) { return; }
                    try {
                        const marks=await worksheet.getSelectedMarksAsync();
                        if(disposed||request!==markRequest||activeBinding!==currentBinding.current) { return; }
                        const values=marks.data.flatMap(table => {
                            const column=table.columns.find(candidate => candidate.fieldId===activeBinding.idColumn.fieldId);
                            return column?table.data.map(row => String(getHierarchyValue(row[column.index])).trim()):[];
                        });
                        setExternalSelection({ values, revision: request });
                    }
                    catch(failure) { if(!disposed) { setOutputError(describeError(failure)); } }
                };
                selectionRef.current=createVizSelection(worksheet, tableau.SelectionUpdateType.Replace,
                    failure => setOutputError(describeError(failure)));
                runtimeRef.current=createVizRefresh(worksheet, next => {
                    currentBinding.current=next;
                    setBinding(next);
                    setVersion(value => value+1);
                    setError('');
                    setReady(true);
                    void readSelection();
                }, failure => {
                    currentBinding.current=undefined;
                    setBinding(undefined);
                    setError(describeError(failure));
                    setReady(true);
                });
                listeners.push(worksheet.addEventListener(tableau.TableauEventType.SummaryDataChanged,
                    () => runtimeRef.current?.refresh()));
                listeners.push(worksheet.addEventListener(tableau.TableauEventType.MarkSelectionChanged, () => { void readSelection(); }));
                listeners.push(tableau.extensions.settings.addEventListener(tableau.TableauEventType.SettingsChanged, readSettings));
                runtimeRef.current.refresh();
            }
            catch(failure) {
                if(!disposed) { setError(describeError(failure)); setReady(true); }
            }
        };
        void initialize();
        return () => {
            disposed=true;
            runtimeRef.current?.dispose();
            selectionRef.current?.dispose();
            listeners.forEach(remove => remove());
        };
    }, []);

    const updatePreferences=(next: VizPreferences): void => {
        if(next.selectionBehavior!==preferenceRef.current.selectionBehavior&&currentBinding.current) {
            selectionRef.current?.select(currentBinding.current, []);
        }
        preferenceRef.current=next;
        setPreferences(next);
    };
    const save=async (): Promise<void> => {
        if(saving||!authoring) { return; }
        const snapshot={...preferenceRef.current};
        setSaving(true);
        setOutputError('');
        try {
            tableau.extensions.settings.set(SETTINGS_KEY, JSON.stringify(snapshot));
            await tableau.extensions.settings.saveAsync();
            savedPreferences.current=snapshot;
            setSettingsOpen(false);
        }
        catch(failure) { setOutputError(describeError(failure)); }
        finally { setSaving(false); }
    };
    const select=(payload: HierarchySelectionPayload): void => {
        if(!binding||payload.selectedLeafValues===undefined) { return; }
        setOutputError('');
        selectionRef.current?.select(binding, payload.selectedLeafValues);
    };
    const data=useMemo(() => binding?{ ...binding.data, options: { ...binding.data.options,
        compactMode: preferences.compact, selectionBehavior: preferences.selectionBehavior } }:undefined,
    [binding, preferences.compact, preferences.selectionBehavior]);
    const exportSettings=(): void => {
        const url=URL.createObjectURL(new Blob([JSON.stringify(preferences, null, 2)], {type: 'application/json'}));
        const link=document.createElement('a');
        link.href=url; link.download='hierarchy-viz.json'; link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    return <main className='hierarchy-viz'>
        <header className='viz-header'>
            <div><span className='viz-eyebrow'>HIERARCHY</span><h1>{t('Hierarchy Navigator')}</h1></div>
            {ready&&worksheetRef.current&&<button onClick={() => setSettingsOpen(value => !value)} aria-expanded={settingsOpen}>{t('Settings')}</button>}
        </header>
        {settingsOpen&&<section className='viz-settings' aria-label={t('Settings')}>
            <fieldset disabled={saving}>
            <label><input type='checkbox' checked={preferences.compact} onChange={event => updatePreferences({...preferences, compact:event.target.checked})}/>{t('Compact mode')}</label>
            <label>{t('Parent selection')}<select value={preferences.selectionBehavior} onChange={event => updatePreferences({...preferences, selectionBehavior:event.target.value as SelectionBehavior})}>
                <option value={SelectionBehavior.TERMINAL}>{t('Terminal descendants')}</option>
                <option value={SelectionBehavior.SUBTREE}>{t('Entire subtree')}</option>
                <option value={SelectionBehavior.NODE}>{t('Direct node only')}</option>
            </select></label>
            <p>{t('Assign fields on the Marks card. Use Tableau selection actions to filter other worksheets or update parameters.')}</p>
            <div className='viz-settings-actions'>
                {authoring&&<button disabled={saving} onClick={() => void save()}>{t(saving?'Saving…':'Save in workbook')}</button>}
                <button onClick={exportSettings}>{t('Export settings')}</button>
                <button onClick={() => fileInput.current?.click()}>{t('Import settings')}</button>
                <button disabled={saving} onClick={() => { updatePreferences(savedPreferences.current); setSettingsOpen(false); }}>{t('Cancel')}</button>
                <input ref={fileInput} type='file' accept='.json,application/json' hidden onChange={async event => {
                    const file=event.target.files?.[0]; event.target.value='';
                    if(!file) { return; }
                    try { updatePreferences(parseVizPreferences(await file.text())); setOutputError(''); }
                    catch(failure) { setOutputError(describeError(failure)); }
                }}/>
            </div>
            </fieldset>
        </section>}
        {outputError&&<div className='viz-notice' role='alert'>{t(outputError)}<button onClick={() => { setOutputError(''); runtimeRef.current?.refresh(); }}>{t('Refresh')}</button></div>}
        {!ready&&<div className='viz-empty' role='status'>{t(delayed?'Tableau is still connecting. The extension will open automatically when initialization finishes.':'Loading…')}</div>}
        {error&&<section className='viz-empty' role='alert'><h2>{t('Set up your hierarchy')}</h2><p>{t(error)}</p>
            <ol><li>{t('Hierarchy: ordered levels, or one label for a recursive hierarchy.')}</li><li>{t('Node ID: a unique key for each row.')}</li><li>{t('Parent ID: optional, enables a recursive hierarchy.')}</li></ol>
            <button onClick={() => runtimeRef.current?runtimeRef.current.refresh():window.location.reload()}>{t('Retry')}</button>
        </section>}
        {binding&&data&&<>
            {binding.dataset.rows.length===0&&<p className='viz-empty' role='status'>{t('No rows match the current worksheet filters.')}</p>}
            {binding.warnings.map(warning => <p className='viz-notice' role='status' key={warning}>{warning}</p>)}
            <Hierarchy data={data} dataset={binding.dataset} externalSelection={externalSelection}
                currentId='' currentLabel='' refreshVersion={version} reapplySelectionsVersion={0}
                onDiagnosticsChange={setDiagnostics} onVirtualizationChange={noOp} setDataFromExtension={select}/>
            <footer className='viz-footer'><span>{worksheetRef.current?.name}</span><span>{diagnostics?`${diagnostics.rowCount} ${t('rows')} · ${diagnostics.nodeCount} ${t('nodes')}`:''}</span>
                <button onClick={() => runtimeRef.current?.refresh()}>{t('Refresh')}</button></footer>
        </>}
    </main>;
}

const container=document.getElementById('app');
if(container) { createRoot(container).render(<LocalizationProvider><HierarchyViz/></LocalizationProvider>); }
