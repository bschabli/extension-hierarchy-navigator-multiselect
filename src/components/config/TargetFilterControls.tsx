import { Checkbox } from '@tableau/tableau-ui';
import React from 'react';
import { HierarchyProps, Status } from '../API/Interfaces';
import { Selector } from '../shared/Selector';
import { ConfigSection } from './ConfigPrimitives';

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
        <>
            <ConfigSection
                title='Filter a dashboard worksheet'
                description='When users change the hierarchy selection, apply the selected leaf values to another worksheet.'
            >
                <div className='config-option-row'>
                    <div>
                        <strong>Apply selection as a filter</strong>
                        <p>Recommended when the navigator should control the visible marks in the dashboard.</p>
                    </div>
                <Checkbox
                    disabled={targetFields.length===0}
                    checked={props.data.worksheet.filterEnabled}
                    onChange={props.changeEnabled}
                    data-type='filter'
                    aria-label='Apply selection as a filter'
                />
                </div>
                {props.data.worksheet.filterEnabled?
                    <div className='config-field-grid config-field-grid--two config-revealed-options'>
                        <Selector
                            title='Target worksheet'
                            description='The worksheet that should react to hierarchy selections.'
                            required={true}
                            status={props.data.dashboardItems.targetWorksheets.length? Status.set:Status.notpossible}
                            list={props.data.dashboardItems.targetWorksheets}
                            selected={props.data.worksheet.targetName}
                            onChange={(event) => props.setUpdates({ type: 'SET_TARGET_WORKSHEET', data: event.target.value })}
                        />
                        <Selector
                            title='Target filter field'
                            description='Usually the unique path ID or leaf-level field used by the target worksheet.'
                            required={true}
                            status={targetFields.length? Status.set:Status.notpossible}
                            list={targetFields}
                            selected={props.data.worksheet.targetFilter}
                            onChange={(event) => props.setUpdates({ type: 'SET_TARGET_FILTER_FIELD', data: event.target.value })}
                        />
                    </div>:
                    <p className='config-muted-note'>Filtering is off. The navigator will keep its selection internally unless another output below is enabled.</p>
                }
            </ConfigSection>
            <ConfigSection
                title='Select marks on the source worksheet'
                description='Visually select the matching marks in the hierarchy source worksheet. This is separate from filtering a target worksheet.'
                optional={true}
            >
                <div className='config-option-row'>
                    <div>
                        <strong>Enable source mark selection</strong>
                        <p>Useful for dashboard actions that start from selected marks on the source sheet.</p>
                    </div>
                <Checkbox
                    checked={props.data.worksheet.enableMarkSelection}
                    onChange={props.changeEnabled}
                    data-type='mark'
                    aria-label='Enable source mark selection'
                />
                </div>
            </ConfigSection>
        </>
    );
}
