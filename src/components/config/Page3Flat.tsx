// import {  DataType } from '@tableau/extensions-api-types/ExternalContract/Namespaces/Tableau';
import React, { useEffect, useState } from 'react';
import { HierarchyProps, isDebugEnabled, Status } from '../API/Interfaces';
import { withHTMLSpaces } from '../API/Utils';
import { useTranslation } from '../localization/I18n';
import { Selector } from '../shared/Selector';
import { ConfigSection, ConfigStepIntro } from './ConfigPrimitives';
import { SelectionBehaviorControls } from './SelectionBehaviorControls';
import { TargetFilterControls } from './TargetFilterControls';
import { Checkbox, TextField, TextFieldProps } from '../shared/UiComponents';

interface Props {
    data: HierarchyProps;
    setUpdates: (obj: { type: string, data: any; }) => void;
    changeEnabled: (s: React.MouseEvent<HTMLInputElement, MouseEvent>|React.ChangeEvent<HTMLInputElement>) => void;
    changeParam: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    onClear?: () => void;
}

export function Page3Flat(props: Props) {
    const {t}=useTranslation();
    const [levelParam, setLevelParam]=useState<boolean>(false);
    const debug=isDebugEnabled(props.data.options.debug);

    // Legacy migration: keep generated field parameter names aligned with the hierarchy levels.
    useEffect(() => {
        if (props.data.parameters.fields.length !== props.data.worksheet.fields.length){
            props.setUpdates({type: 'SET_FIELDS', data: props.data.worksheet.fields});
        }
    }, []);

    // Tableau parameter metadata can resolve out of order while the suffix is edited.
    useEffect(() => {
        let cancelled=false;
        const check=async (): Promise<void> => {
            if(debug) {
                console.log(`checking if ${props.data.parameters.level} is a viable numeric parameter`);
            }
            const dashboardContent=window.tableau&&window.tableau.extensions.dashboardContent;
            if(!dashboardContent) {
                if(!cancelled) { setLevelParam(false); }
                return;
            }
            const params=await dashboardContent.dashboard.getParametersAsync();
            if(cancelled) { return; }
            if(debug) { console.log(`parameters found`); }
            setLevelParam(params.some(parameter => {
                if(debug) { console.log(parameter); }
                return parameter.dataType==='int'&&parameter.name===props.data.parameters.level;
            }));
        };
        check().catch(error => {
            if(cancelled) { return; }
            console.warn('Unable to inspect dashboard parameters.', error);
            setLevelParam(false);
        });
        return () => { cancelled=true; };
    }, [props.data.parameters.level]);

    const inputProps: TextFieldProps & React.RefAttributes<HTMLInputElement>={
        message: undefined,
        kind: 'line' as 'line'|'outline'|'search',
        label: t('Suffix for all parameters'),
        onChange: (e: any) => {
            props.setUpdates({ type: 'SET_PARAM_SUFFiX', data: e.target.value });
        },
        onClear: () => {
            props.setUpdates({ type: 'SET_PARAM_SUFFiX', data: ' Param' });
        },
        style: { width: '100%' },
        value: props.data.paramSuffix,
    };

    const yes=(<span style={{ color: 'green', marginRight: '0.5em' }}>✔</span>);
    const no=(<span style={{ marginRight: '0.5em' }}>⚠️</span>);

    const idPresent=() => {
        return props.data.dashboardItems.parameters.includes(`${ props.data.parameters.childId }`)? yes:no;
    };
    const labelPresent=() => {
        return props.data.dashboardItems.parameters.includes(`${ props.data.parameters.childLabel }`)? yes:no;
    };
    const paramPresent=(param: string) => {
        return props.data.dashboardItems.parameters.includes(`${ param }`)? yes:no;
    };
    return (
        <div className='config-page'>
            <ConfigStepIntro
                eyebrow={t('Step {current} of {total}', { current: 3, total: 4 })}
                title={t('Choose what a selection controls')}
                description={t('Filtering is the usual choice. Parameters and source mark selection are optional integrations for more advanced dashboards.')}
            />
            <SelectionBehaviorControls data={props.data} setUpdates={props.setUpdates} />
            <TargetFilterControls {...props} />
            <details className='config-advanced' open={props.data.parameters.childLabelEnabled}>
                <summary>
                    <span>
                        <strong>{t('Advanced: write values to parameters')}</strong>
                        <small>{t('Expose selected hierarchy values to calculations and parameter actions.')}</small>
                    </span>
                </summary>
                <ConfigSection
                    title={t('Parameter outputs')}
                    description={t('The extension looks for parameters named after each hierarchy field plus the suffix below. Create them in Tableau before enabling this integration.')}
                    optional={true}
                >
                    <div className='config-field config-compact-field'>
                        <TextField {...inputProps} />
                        <p className='config-field-help'>{t('Example: a field named Category with the default suffix maps to Category Param.')}</p>
                    </div>
                    <div className='config-toggle-field'>
                    <Checkbox
                        disabled={!props.data.dashboardItems.flatParameters.length}
                        checked={props.data.parameters.childLabelEnabled}
                        onChange={props.changeEnabled}
                        data-type='label'
                    >
                        {t('Also write the selected item label to a parameter')}
                    </Checkbox>
                    {props.data.parameters.childLabelEnabled&&
                        <Selector
                            title={t('Selected label parameter')}
                            status={props.data.dashboardItems.parameters.length? Status.set:Status.notpossible}
                            onChange={props.changeParam}
                            list={props.data.dashboardItems.flatParameters}
                            selected={props.data.parameters.childLabel}
                            type='label'
                        />
                    }
                    </div>
                    <div className='config-parameter-check'>
                        <strong>{t('Parameters the extension expects')}</strong>
                        <p>{t('Green checks are ready. Warnings mean the parameter still needs to be created or renamed in Tableau.')}</p>
                        <ul>
                            <li>{levelParam? yes:no}<span><b>{withHTMLSpaces(props.data.parameters.level)}</b><small>{t('Current selected level (1…n)')}</small></span></li>
                            <li>{idPresent()}<span><b>{withHTMLSpaces(props.data.parameters.childId)}</b><small>{t('Unique ID of the selected item')}</small></span></li>
                            {props.data.parameters.childLabelEnabled&&
                                <li>{labelPresent()}<span><b>{withHTMLSpaces(props.data.parameters.childLabel)}</b><small>{t('Visible label of the selected item')}</small></span></li>
                            }
                        {props.data.parameters.fields.map((param) => {
                                return <li key={param+'_item'} value={param}>{paramPresent(param)}<span><b>{withHTMLSpaces(param)}</b><small>{t('Selected value for this hierarchy level')}</small></span></li>;
                        })}
                        </ul>
                    </div>
                </ConfigSection>
            </details>
        </div>
    );
}
