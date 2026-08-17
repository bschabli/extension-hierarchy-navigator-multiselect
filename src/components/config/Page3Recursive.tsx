import { Checkbox } from '@tableau/tableau-ui';
import React from 'react';
import { HierarchyProps, Status } from '../API/Interfaces';
import { Selector } from '../shared/Selector';
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
        <>
            <div className='sectionStyle mb-2'>
                <b>Parameters</b>
                <br />
                <div style={{ marginLeft: '9px' }}>
                    <Checkbox
                        disabled={!props.data.dashboardItems.parameters.length}
                        checked={props.data.parameters.childIdEnabled}
                        onChange={props.changeEnabled}
                        data-type='id'
                    >Parameter for Child Id Field
        </Checkbox>
                    <Selector
                        status={props.data.parameters.childIdEnabled? (props.data.dashboardItems.parameters.length? Status.set:Status.notpossible):Status.notpossible}
                        onChange={props.changeParam}
                        list={props.data.dashboardItems.parameters}
                        selected={props.data.parameters.childId}
                        type='id'
                    />
                    <Checkbox
                        disabled={!props.data.dashboardItems.parameters.length}
                        checked={props.data.parameters.childLabelEnabled}
                        onChange={props.changeEnabled}
                        data-type='label'
                    >
                        Parameter for Child Label Field
        </Checkbox>
                    <Selector
                        // For label field'
                        status={props.data.parameters.childLabelEnabled?
                            (props.data.dashboardItems.parameters.length? Status.set:Status.notpossible):Status.notpossible}
                        onChange={props.changeParam}
                        list={props.data.dashboardItems.parameters}
                        selected={props.data.parameters.childLabel}
                        type='label'
                    />
                </div>
            </div>
            <TargetFilterControls {...props} />
        </>
    );
}
