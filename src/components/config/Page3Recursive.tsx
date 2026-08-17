import { Checkbox } from '@tableau/tableau-ui';
import React from 'react';
import { HierarchyProps, Status } from '../API/Interfaces';
import { Selector } from '../shared/Selector';
import { ConfigSection, ConfigStepIntro } from './ConfigPrimitives';
import { TargetFilterControls } from './TargetFilterControls';

interface Props {
    data: HierarchyProps;
    setUpdates: (obj: { type: string, data: any; }) => void;
    changeEnabled: (s: React.MouseEvent<HTMLInputElement, MouseEvent>|React.ChangeEvent<HTMLInputElement>) => void;
    changeParam: (e: React.ChangeEvent<HTMLSelectElement>) => void;

}

export function Page3Recursive(props: Props) {
    // PARAMETERS CONTENT
    return (
        <div className='config-page'>
            <ConfigStepIntro
                eyebrow='Step 3 of 4'
                title='Choose what a selection controls'
                description='Filtering is the usual choice. Parameters and source mark selection are optional integrations for more advanced dashboards.'
            />
            <TargetFilterControls {...props} />
            <details className='config-advanced' open={props.data.parameters.childIdEnabled||props.data.parameters.childLabelEnabled}>
                <summary>
                    <span>
                        <strong>Advanced: write values to parameters</strong>
                        <small>Expose the selected item to calculations and parameter actions.</small>
                    </span>
                </summary>
                <ConfigSection
                    title='Parameter outputs'
                    description='Create string parameters in Tableau first, then map them here. Leave these off if filtering is all you need.'
                    optional={true}
                >
                    <div className='config-toggle-field'>
                    <Checkbox
                        disabled={!props.data.dashboardItems.parameters.length}
                        checked={props.data.parameters.childIdEnabled}
                        onChange={props.changeEnabled}
                        data-type='id'
                        aria-label='Write selected child ID to a parameter'
                    >Write selected item ID to a parameter</Checkbox>
                    {props.data.parameters.childIdEnabled&&
                        <Selector
                            title='Item ID parameter'
                            status={props.data.dashboardItems.parameters.length? Status.set:Status.notpossible}
                            onChange={props.changeParam}
                            list={props.data.dashboardItems.parameters}
                            selected={props.data.parameters.childId}
                            type='id'
                        />
                    }
                    </div>
                    <div className='config-toggle-field'>
                    <Checkbox
                        disabled={!props.data.dashboardItems.parameters.length}
                        checked={props.data.parameters.childLabelEnabled}
                        onChange={props.changeEnabled}
                        data-type='label'
                        aria-label='Write selected child label to a parameter'
                    >Write selected item label to a parameter</Checkbox>
                    {props.data.parameters.childLabelEnabled&&
                        <Selector
                            title='Item label parameter'
                            status={props.data.dashboardItems.parameters.length? Status.set:Status.notpossible}
                            onChange={props.changeParam}
                            list={props.data.dashboardItems.parameters}
                            selected={props.data.parameters.childLabel}
                            type='label'
                        />
                    }
                    </div>
                    {!props.data.dashboardItems.parameters.length&&
                        <p className='config-muted-note'>No compatible string or integer parameters were found on this dashboard.</p>
                    }
                </ConfigSection>
            </details>
        </div>
    );
}
