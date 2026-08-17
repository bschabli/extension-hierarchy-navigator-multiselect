import { Checkbox } from '@tableau/tableau-ui';
import React from 'react';
import { HierarchyProps, Status } from '../API/Interfaces';
import { Selector } from '../shared/Selector';

interface Props {
    changeEnabled: (event: React.MouseEvent<HTMLInputElement, MouseEvent>|React.ChangeEvent<HTMLInputElement>) => void;
    data: HierarchyProps;
    setUpdates: (update: { type: string, data: any }) => void;
}

/** Render the shared target worksheet/filter configuration for both modes. */
export function TargetFilterControls(props: Props) {
    const targetItems=props.data.dashboardItems.allWorksheetItems[props.data.worksheet.targetName];
    const targetFields=targetItems? Array.from(new Set(targetItems.fields.concat(targetItems.filters))):[];

    return (
        <div className='sectionStyle mb-2'>
            <b>Sheet Interactions</b>
            <div style={{ marginLeft: '9px' }}>
                <Checkbox
                    disabled={targetFields.length===0}
                    checked={props.data.worksheet.filterEnabled}
                    onChange={props.changeEnabled}
                    data-type='filter'
                >Apply selected leaf values as a filter</Checkbox>
                <Selector
                    title='Target Worksheet'
                    status={props.data.dashboardItems.targetWorksheets.length? Status.set:Status.notpossible}
                    list={props.data.dashboardItems.targetWorksheets}
                    selected={props.data.worksheet.targetName}
                    onChange={(event) => props.setUpdates({ type: 'SET_TARGET_WORKSHEET', data: event.target.value })}
                />
                <Selector
                    title='Target Filter Field'
                    status={targetFields.length? Status.set:Status.notpossible}
                    list={targetFields}
                    selected={props.data.worksheet.targetFilter}
                    onChange={(event) => props.setUpdates({ type: 'SET_TARGET_FILTER_FIELD', data: event.target.value })}
                />
                <Checkbox
                    checked={props.data.worksheet.enableMarkSelection}
                    onChange={props.changeEnabled}
                    data-type='mark'
                >Enable Mark Selection on the source worksheet</Checkbox>
            </div>
        </div>
    );
}
