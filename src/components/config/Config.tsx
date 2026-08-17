/* tslint:disable:jsx-no-lambda */
import '../../css/bootstrap.css';
import '../../css/style.css';
import { Extensions } from '@tableau/extensions-api-types';
import { Button, Spinner } from '@tableau/tableau-ui';
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Alert } from 'reactstrap';
import flatHier from '../../images/FlatHier.jpeg';
import recursiveHier from '../../images/RecursiveHier.jpeg';
import HierarchyAPI from '../API/HierarchyAPI';
import { debugOverride, HierarchyProps, HierType } from '../API/Interfaces';
import { ConfigStatus, ConfigStepIntro } from './ConfigPrimitives';
import { Page2Flat } from './Page2Flat';
import { Page2Recursive } from './Page2Recursive';
import { Page3Flat } from './Page3Flat';
import { Page3Recursive } from './Page3Recursive';
import { Page4 } from './Page4';
import { useHierarchyValidation } from './useHierarchyValidation';

declare global {
    interface Window { tableau: { extensions: Extensions; }; }
}

function Configure(props: any) {
    const [state, setCurrentWorksheetName, setUpdates] = HierarchyAPI();
    const [selectedTabIndex, setSelectedTabIndex] = useState(0);
    const { data, isError, errorStr, doneLoading }: { data: HierarchyProps, isLoading: boolean, isError: boolean, errorStr: string, doneLoading: boolean; } = state;
    const [debug, setDebug] = useState(debugOverride);

    useEffect(() => {
        setDebug(state.data.options.debug || debugOverride);
    }, [state.data.options.debug])

    // event fired when one of the parameters/filter/mark selection is changed
    const changeEnabled = (e: React.MouseEvent<HTMLInputElement> | React.ChangeEvent<HTMLInputElement>) => {
        if (debug) {
            console.log(`event type change param enabled: vvv`);
            console.log(e);
        }
        const target = e.target as HTMLInputElement;
        const type: string | null = (e.target as HTMLButtonElement).getAttribute('data-type');
        if (typeof type === 'string') {
            if (debug) { console.log(`changing param enabled for ${type} -- ${target.checked}`); }

            switch (type) {
                case 'id':
                    setUpdates({ type: 'TOGGLE_ID_PARAMETER_ENABLED', data: target.checked });
                    break;
                case 'label':
                    setUpdates({ type: 'TOGGLE_LABEL_PARAMETER_ENABLED', data: target.checked });
                    break;
                case 'filter':
                    setUpdates({ type: 'TOGGLE_FILTER_ENABLED', data: target.checked });
                    break;
                case 'mark':
                    setUpdates({ type: 'TOGGLE_MARKSELECTION_ENABLED', data: target.checked });
                    break;
            }
        }
    };

    // handles changing either the childId or parentId field in the hierarchy
    const changeParam = (e: React.ChangeEvent<HTMLSelectElement>): void => {
        const type: string | null = e.target.getAttribute('data-type');
        if (typeof type === 'string') {
            if (type === 'id') {
                setUpdates({ type: 'SET_CHILD_ID_PARAMETER', data: e.target.value });
            }
            else if (type === 'label') {
                setUpdates({ type: 'SET_CHILD_LABEL_PARAMETER', data: e.target.value });
            }
        }
    };
    // change to next tab in UI
    const changeTabNext = () => {
        if (debug) { console.log(`onChange tab next: ${selectedTabIndex}`); }
        if (selectedTabIndex < 3) {
            setSelectedTabIndex((prev: number) => prev + 1);
        }
    };
    // change to prev tab in UI
    const changeTabPrevious = () => {
        if (debug) { console.log(`onChange tab previous: ${selectedTabIndex}`); }
        if (selectedTabIndex > 0) {
            setSelectedTabIndex((prev: number) => prev - 1);
        }
    };
    // change Hier Type
    const changeHierType = (type: HierType) => {
        if (debug) { console.log(`clicked hier type image: ${type}`); }
        setUpdates({ type: 'CHANGE_HIER_TYPE', data: type });
    };


    const page: Array<{ name: string, description: string, content: React.ReactFragment; }> = [
        { name: 'Hierarchy format', description: 'Choose the shape of your data', content: (<div />) },
        { name: 'Source data', description: 'Map the worksheet and fields', content: (<div />) },
        { name: 'Dashboard actions', description: 'Choose what selection controls', content: (<div />) },
        { name: 'Review & display', description: 'Confirm settings and appearance', content: (<div />) }
    ];
    const sourceComplete=data.worksheet.name!==''&&data.worksheet.childId!==''&&(
        (data.type===HierType.FLAT&&data.worksheet.fields.length>0)||
        (data.type===HierType.RECURSIVE&&data.worksheet.parentId!==''&&data.worksheet.childLabel!=='')
    );
    const { retry: retryValidation, state: validation }=useHierarchyValidation(
        data,
        sourceComplete
    );
    const saveReady=sourceComplete&&validation.status==='complete'&&Boolean(validation.result?.valid);
    const submit = () => {
        if(saveReady) { setUpdates({ type: 'SUBMIT' }); }
    };
    const saveStatus=!sourceComplete?'Complete the required source fields before saving.':
        validation.status==='loading'?'Checking the source worksheet before saving…':
        validation.status==='error'?'Validation must finish successfully before saving.':
        validation.status==='complete'&&!validation.result?.valid?'Fix the data issues shown above before saving.':
        validation.status==='idle'?'Waiting to validate the source worksheet…':'';
    const stepComplete=[true, sourceComplete, false, false];
    const isStepComplete=(index: number): boolean => stepComplete[index]||(index>1&&selectedTabIndex>index);

    // WORKSHEET CONTENT
    page[0].content = (
        <div className='config-page'>
            <ConfigStepIntro
                eyebrow='Step 1 of 4'
                title='How is your hierarchy stored?'
                description='Choose the format used by the dedicated source worksheet. The worksheet can be hidden after configuration.'
            />
            <div className='config-choice-grid' role='radiogroup' aria-label='Hierarchy format'>
                <button
                    className={`config-choice ${data.type===HierType.FLAT?'config-choice--selected':''}`}
                    type='button'
                    role='radio'
                    aria-checked={data.type===HierType.FLAT}
                    onClick={() => changeHierType(HierType.FLAT)}
                >
                    <div className='config-choice-heading'>
                        <div>
                            <span className='config-choice-title'>Separate level columns</span>
                            <span className='config-tag config-tag--recommended'>Recommended</span>
                        </div>
                        <span className='config-radio' aria-hidden='true' />
                    </div>
                    <img src={flatHier} alt='Example table with one column for each hierarchy level' />
                    <p>Use this when each level—such as Category, Sub-category, and Product—has its own field.</p>
                </button>
                <button
                    className={`config-choice ${data.type===HierType.RECURSIVE?'config-choice--selected':''}`}
                    type='button'
                    role='radio'
                    aria-checked={data.type===HierType.RECURSIVE}
                    onClick={() => changeHierType(HierType.RECURSIVE)}
                >
                    <div className='config-choice-heading'>
                        <span className='config-choice-title'>Parent and child rows</span>
                        <span className='config-radio' aria-hidden='true' />
                    </div>
                    <img src={recursiveHier} alt='Example table with parent and child columns' />
                    <p>Use this when every row identifies one item and its parent, such as Manager ID and Employee ID.</p>
                </button>
            </div>
            <div className='config-callout'>
                <strong>Not sure?</strong> Choose separate level columns if your Tableau view already contains one dimension for every hierarchy level.
            </div>
        </div>
    );

    function returnPage(index: number) {
        switch (index) {
            case 0:
                return (<span>{page[index].content}</span>);
            case 1:
                if (data.type === HierType.FLAT) {
                    return <Page2Flat
                        data={data}
                        setUpdates={setUpdates}
                        setCurrentWorksheetName={setCurrentWorksheetName}
                    />;
                }

                else if (data.type === HierType.RECURSIVE) {
                    return <Page2Recursive
                        data={data}
                        setUpdates={setUpdates}
                        setCurrentWorksheetName={setCurrentWorksheetName}
                    />;
                }
            case 2:
                if (data.type === HierType.FLAT) {
                    return <Page3Flat
                        data={data}
                        setUpdates={setUpdates}
                        changeEnabled={changeEnabled}
                        changeParam={changeParam}
                    />;
                }
                else {
                    return <Page3Recursive
                        data={data}
                        setUpdates={setUpdates}
                        changeEnabled={changeEnabled}
                        changeParam={changeParam}

                    />;
                }
            case 3:
                return <Page4
                    data={data}
                    validation={validation}
                    onRetryValidation={retryValidation}
                    setUpdates={setUpdates}
                />
            default:
                return (<div>Not here yet</div>);
        }
    }
    const onDismiss = () => {
        setUpdates({ type: 'CLEAR_ERROR' });
    };
    const onDismissWarning = () => {
        setUpdates({ type: 'CLEAR_WARNING' });
    };
    return (
        <div className='config-shell'>
            {!doneLoading ? (<div aria-busy='true' className='overlay'><div className='centerOnPage'><div className='spinnerBg centerOnPage'>{ }</div><Spinner color='light'
            alt="Loading..." /></div></div>) : undefined}
            <header className='config-app-header'>
                <div>
                    <strong>Hierarchy Navigator</strong>
                    <span>Configuration</span>
                </div>
                <ConfigStatus
                    complete={sourceComplete}
                    completeLabel='Source ready'
                    incompleteLabel='Setup in progress'
                />
            </header>

            <nav className='config-progress' aria-label='Configuration progress'>
                <ol className='config-steps'>
                    {page.map((pageItem, index) => (
                        <li
                            className={`config-step ${selectedTabIndex===index?'config-step--active':''} ${isStepComplete(index)?'config-step--complete':''}`}
                            key={pageItem.name}
                        >
                            <button type='button' onClick={() => setSelectedTabIndex(index)} aria-current={selectedTabIndex===index?'step':undefined}>
                                <span className='config-step-number'>{isStepComplete(index)?'✓':index+1}</span>
                                <span className='config-step-copy'>
                                    <strong>{pageItem.name}</strong>
                                    <small>{pageItem.description}</small>
                                </span>
                            </button>
                        </li>
                    ))}
                </ol>
            </nav>
            <main className='config-main'>
                <Alert isOpen={data.options.warningEnabled} color='primary' toggle={onDismissWarning}>
                    New to the extension? Follow the four steps below. The source hierarchy should live on its own worksheet; it can be hidden after setup.
                </Alert>
                <Alert color='warning' isOpen={isError} toggle={onDismiss}>
                    {errorStr}
                </Alert>
                {returnPage(selectedTabIndex)}
            </main>
            <footer className='config-footer'>
                <span className='config-footer-status'>
                    {selectedTabIndex===3?saveStatus:''}
                </span>
                <div className='config-footer-actions'>
                    {selectedTabIndex>0&&
                        <Button kind='outline' onClick={changeTabPrevious}>Previous</Button>
                    }
                    {selectedTabIndex<3&&
                        <Button kind='primary' onClick={changeTabNext}>Continue</Button>
                    }
                    {selectedTabIndex===3&&
                        <Button kind='primary' disabled={!saveReady} onClick={submit}>Save configuration</Button>
                    }
                </div>
            </footer>
        </div>
    );
}

export default Configure;
const container = document.getElementById('app') as HTMLElement;
const root = createRoot(container);
root.render(<Configure tab="configure" />);
