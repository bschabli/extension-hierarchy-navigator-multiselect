import * as t from '@tableau/extensions-api-types';
import { Spinner } from '@tableau/tableau-ui';
import  React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../css/style.css';
import { debugOverride, defaultSelectedProps, HierarchyProps } from '../API/Interfaces';
import { resolveSavedSelectionBehavior } from '../API/SelectionBehavior';
import { LocalizationProvider, useTranslation } from '../localization/I18n';
import ParamHandler from './ParamHandler';
var extend = require('extend');

function hydrateSavedSettings(settingsData: any): HierarchyProps {
    const savedSelectionBehavior=settingsData.options?.selectionBehavior;
    const hydrated=extend(true, {}, defaultSelectedProps, settingsData) as HierarchyProps;
    hydrated.options.selectionBehavior=resolveSavedSelectionBehavior(
        savedSelectionBehavior,
        hydrated.configComplete,
        hydrated.type
    );
    return hydrated;
}

function HierarchyNavigator() {
    const {t}=useTranslation();
    const [dashboard, setDashboard] = useState({});
    const [doneLoading, setDoneLoading] = useState(false);
    const [data, setData] = useState<HierarchyProps>(defaultSelectedProps);
    const [initializationError, setInitializationError] = useState('');

    useEffect(() => {
        window.dispatchEvent(new Event('hierarchy-app-ready'));
    }, []);

    const describeError = (error: any): string => {
        if (error && typeof error.message === 'string') { return error.message; }
        if (error && typeof error.toString === 'function') { return error.toString(); }
        return t('Unknown Tableau Extensions API error.');
    };

    // Pops open the configure page if extension isn't configured
    const configure = async (): Promise<void> => {
        if (debugOverride) { console.log(`calling CONFIGURE`); }

        let popupUrl = `config.html`;
        console.log(`version: ${tableau.extensions.environment.tableauVersion}`);
        console.log(`hostname: ${window.location.hostname}`);
        console.log(window.location)
        const version = tableau.extensions.environment.tableauVersion.split('.');
        // if version < 2019.3 need an absolute URL
        if (parseInt(version[0], 10) === 2018 || (parseInt(version[0], 10) === 2019 && parseInt(version[1], 10) < 3)) {
            const href = window.location.href;
            popupUrl = window.location.href.substring(0, href.lastIndexOf('/')) + '/config.html';
        }
        try {
            const closePayload = await tableau.extensions.ui.displayDialogAsync(
                popupUrl,
                '',
                { height: 650, width: 500 }
            );
            if (debugOverride) { console.log(`returning from Configure! ${closePayload}`); }
            if (closePayload === 'true') {
                const settings = tableau.extensions.settings.getAll();
                console.log(`what is settings?`);
                try {
                    let settingsData = {};
                    if (settings.data) {
                        settingsData = JSON.parse(settings.data);
                        // for compatibility from published 1.0 version to 1.1 
                        if (debugOverride) {
                            console.log(`loaded settingsData:`);
                            console.log(settingsData);
                        }
                        settingsData=hydrateSavedSettings(settingsData);
                        setData(settingsData as HierarchyProps);
                    }
                }
                catch (e) {
                    console.error(`Error loading getAll ${e}`);
                }
                setDoneLoading(true);
            }
        }
        catch (error) {
            switch (error.errorCode) {
                case tableau.ErrorCodes.DialogClosedByUser:
                    if (debugOverride) { console.log('Dialog was closed by user.'); }
                    break;
                default:
                    console.error(error.message);
                    setInitializationError(`Unable to open the configuration dialog: ${describeError(error)}`);
            }
        }
    };

    React.useEffect(() => {
        let timeoutId: number|undefined;

        const initialize = async (): Promise<void> => {
            try {
                if (!window.tableau || !window.tableau.extensions) {
                    throw new Error('The Tableau Extensions API library did not load.');
                }

                const timeout = new Promise<never>((_resolve, reject) => {
                    timeoutId = window.setTimeout(() => {
                        reject(new Error('Tableau did not complete the extension handshake within 15 seconds.'));
                    }, 15000);
                });

                await Promise.race([
                    tableau.extensions.initializeAsync({ configure }),
                    timeout
                ]);
                window.dispatchEvent(new Event('hierarchy-locale-ready'));

                if (typeof timeoutId !== 'undefined') { window.clearTimeout(timeoutId); }
                setDashboard(tableau.extensions.dashboardContent!.dashboard);
                const settings = tableau.extensions.settings.getAll();
                if (typeof settings.data === 'undefined') {
                    setDoneLoading(true);
                    await configure();
                    return;
                }

                try {
                    let settingsData = {};
                    if (settings.data) {
                        settingsData = JSON.parse(settings.data);
                        settingsData=hydrateSavedSettings(settingsData);
                        if (debugOverride) {
                            console.log(`loaded settingsData:`);
                            console.log(settingsData);
                        }
                        setData(settingsData as HierarchyProps);
                    }
                }
                catch (e) {
                    console.error(`Error loading getAll ${e}`);
                }

                setDoneLoading(true);
                document.body.style.backgroundColor = data.options.bgColor || defaultSelectedProps.options.bgColor;
            }
            catch (error) {
                if (typeof timeoutId !== 'undefined') { window.clearTimeout(timeoutId); }
                console.error('Unable to initialize Tableau extension.', error);
                setInitializationError(describeError(error));
                setDoneLoading(true);
            }
        };

        initialize();
        return () => {
            if (typeof timeoutId !== 'undefined') { window.clearTimeout(timeoutId); }
        };
    }, []);

    useEffect(() => {
        document.documentElement.style.setProperty(
            '--highlightColor',
            data.options.highlightColor||defaultSelectedProps.options.highlightColor
        );
    }, [data.options.highlightColor]);
    useEffect(() => {
        document.body.style.backgroundColor = data.options.bgColor || defaultSelectedProps.options.bgColor;
    }, [data.options.bgColor]);
    useEffect(() => {
        document.body.style.fontSize = data.options.fontSize || defaultSelectedProps.options.fontSize;
    }, [data.options.fontSize]);
    useEffect(() => {

        let f = data.options.fontFamily || defaultSelectedProps.options.fontFamily;
        const semi = /;/g;
        const imp = /!important/g
        let important = false;
        if (f.search(imp) >= 0) {
            f = f.replace(semi, '');
            f = f.replace(imp, '');
            important = true;
        }
        document.body.style.setProperty('font-family', f, important ? 'important' : '')

    }, [data.options.fontFamily]);
    useEffect(() => {
        const semi = /;/g;
        const imp = /!important/g
        let important = false;
        let c = data.options.fontColor || defaultSelectedProps.options.fontColor;
        if (c.search(imp) >= 0) {
            c = c.replace(semi, '');
            c = c.replace(imp, '');
            important = true;
        }
        document.body.style.setProperty('color', c, important ? 'important' : '')
    }, [data.options.fontColor]);
    return (
        <>
            {!doneLoading ? (<div aria-busy='true' className='overlay'><div className='centerOnPage'><div className='spinnerBg centerOnPage'>{ }</div><Spinner color='light'
            alt={t('Loading…')} /></div></div>) : undefined}
            {initializationError ? (
                <div className='extension-status' role='alert'>
                    <h2>{t('Hierarchy Navigator could not start')}</h2>
                    <p>{initializationError}</p>
                    <p>{t('Reload the extension after confirming that its exact URL is enabled in Tableau Settings → Extensions.')}</p>
                    <button type='button' onClick={() => window.location.reload()}>{t('Reload Extension')}</button>
                </div>
            ) : doneLoading&&!data.configComplete ? (
                <div className='extension-status'>
                    <h2>{t('Configure Hierarchy Navigator')}</h2>
                    <p>{t('Select the source hierarchy and any target worksheet filters before using the extension.')}</p>
                    <button type='button' onClick={configure}>{t('Configure')}</button>
                </div>
            ) : doneLoading ? (
                <div>
                    <p />
                    <ParamHandler
                        data={data}
                        dashboard={dashboard as t.Dashboard}
                    />
                </div>
            ) : undefined}
        </>
    );
}

const container = document.getElementById('app') as HTMLElement;
const root = createRoot(container);
root.render(<LocalizationProvider><HierarchyNavigator /></LocalizationProvider>);
