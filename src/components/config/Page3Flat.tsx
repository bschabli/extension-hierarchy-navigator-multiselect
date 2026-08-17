// import {  DataType } from '@tableau/extensions-api-types/ExternalContract/Namespaces/Tableau';
import { Checkbox, TextField, TextFieldProps } from '@tableau/tableau-ui';
import { InputAttrs } from '@tableau/tableau-ui/lib/src/utils/NativeProps';
import React, { useEffect, useState } from 'react';
import { debugOverride, HierarchyProps, Status } from '../API/Interfaces';
import { withHTMLSpaces } from '../API/Utils';
import { Selector } from '../shared/Selector';
import { ConfigSection, ConfigStepIntro } from './ConfigPrimitives';
import { TargetFilterControls } from './TargetFilterControls';

interface Props {
    data: HierarchyProps;
    setUpdates: (obj: { type: string, data: any; }) => void;
    changeEnabled: (s: React.MouseEvent<HTMLInputElement, MouseEvent>|React.ChangeEvent<HTMLInputElement>) => void;
    changeParam: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    onClear?: () => void;
}

export function Page3Flat(props: Props) {
    const [levelParam, setLevelParam]=useState<boolean>(false);
    const {debug=false||debugOverride} = props.data.options;
    // check level param upon page load
    useEffect(() => {
        if(debug) { console.log(`checking if ${props.data.parameters.level} is a viable numeric parameter`); }
        checkLevelParam();

        // legacy... to upgrade to new parameters format
        if (props.data.parameters.fields.length !== props.data.worksheet.fields.length){
            props.setUpdates({type: 'SET_FIELDS', data: props.data.worksheet.fields});
        }
    }, []);

    // Is there a parameter that exists that matches the name/type?
    // This is used on Page3Flat to check if the Level parameter of type int is present
    // String parameters are the only one stored hence the need for an additional check
    useEffect(() => {
        checkLevelParam();
    }, [props.data.paramSuffix]);

    // function to set the 
    const checkLevelParam = () => {
        const check=async () => {
            const dashboardContent=window.tableau&&window.tableau.extensions.dashboardContent;
            if(!dashboardContent) {
                setLevelParam(false);
                return;
            }
            await dashboardContent.dashboard.getParametersAsync()
                .then(params => {

                    if(debug) { console.log(`parameters found`); }
                    for(const p of params) {
                        if(debug) { console.log(p); }
                        if(p.dataType==='int'&&p.name===props.data.parameters.level ) {
                            return setLevelParam(true);
                        }
                    }
                    setLevelParam(false);
                });
        };
        check();
    }

    const inputProps: TextFieldProps & InputAttrs & React.RefAttributes<HTMLInputElement>={
        message: undefined,
        kind: 'line' as 'line'|'outline'|'search',
        label: `Suffix for all Parameters.`,
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
                eyebrow='Step 3 of 4'
                title='Choose what a selection controls'
                description='Filtering is the usual choice. Parameters and source mark selection are optional integrations for more advanced dashboards.'
            />
            <TargetFilterControls {...props} />
            <details className='config-advanced' open={props.data.parameters.childLabelEnabled}>
                <summary>
                    <span>
                        <strong>Advanced: write values to parameters</strong>
                        <small>Expose selected hierarchy values to calculations and parameter actions.</small>
                    </span>
                </summary>
                <ConfigSection
                    title='Parameter outputs'
                    description='The extension looks for parameters named after each hierarchy field plus the suffix below. Create them in Tableau before enabling this integration.'
                    optional={true}
                >
                    <div className='config-field config-compact-field'>
                        <TextField {...inputProps} />
                        <p className='config-field-help'>Example: a field named Category with the default suffix maps to Category Param.</p>
                    </div>
                    <div className='config-toggle-field'>
                    <Checkbox
                        disabled={!props.data.dashboardItems.flatParameters.length}
                        checked={props.data.parameters.childLabelEnabled}
                        onChange={props.changeEnabled}
                        data-type='label'
                    >
                        Also write the selected item label to a parameter
                    </Checkbox>
                    {props.data.parameters.childLabelEnabled&&
                        <Selector
                            title='Selected label parameter'
                            status={props.data.dashboardItems.parameters.length? Status.set:Status.notpossible}
                            onChange={props.changeParam}
                            list={props.data.dashboardItems.flatParameters}
                            selected={props.data.parameters.childLabel}
                            type='label'
                        />
                    }
                    </div>
                    <div className='config-parameter-check'>
                        <strong>Parameters the extension expects</strong>
                        <p>Green checks are ready. Warnings mean the parameter still needs to be created or renamed in Tableau.</p>
                        <ul>
                            <li>{levelParam? yes:no}<span><b>{withHTMLSpaces(props.data.parameters.level)}</b><small>Current selected level (1…n)</small></span></li>
                            <li>{idPresent()}<span><b>{withHTMLSpaces(props.data.parameters.childId)}</b><small>Unique ID of the selected item</small></span></li>
                            {props.data.parameters.childLabelEnabled&&
                                <li>{labelPresent()}<span><b>{withHTMLSpaces(props.data.parameters.childLabel)}</b><small>Visible label of the selected item</small></span></li>
                            }
                        {props.data.parameters.fields.map((param) => {
                                return <li key={param+'_item'} value={param}>{paramPresent(param)}<span><b>{withHTMLSpaces(param)}</b><small>Selected value for this hierarchy level</small></span></li>;
                        })}
                        </ul>
                    </div>
                </ConfigSection>
            </details>
        </div>
    );
}
