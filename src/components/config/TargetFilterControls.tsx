import { Button, Checkbox } from '@tableau/tableau-ui';
import React from 'react';
import { resolveFilterTargets } from '../API/FilterTargets';
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
    const targets=resolveFilterTargets(props.data.worksheet);
    const usedWorksheetNames=new Set(targets.map(target => target.worksheetName));
    const worksheetsWithFields=props.data.dashboardItems.targetWorksheets.filter(name => {
        const items=props.data.dashboardItems.allWorksheetItems[name];
        return Boolean(items&&(items.fields.length||items.filters.length));
    });
    const availableWorksheetNames=worksheetsWithFields.filter(name => !usedWorksheetNames.has(name));

    return (
        <>
            <ConfigSection
                title='Filter dashboard worksheets'
                description='Apply the selected hierarchy IDs to one or more worksheets. Each worksheet can use its own matching filter field.'
            >
                <div className='config-option-row'>
                    <div>
                        <strong>Apply selection as filters</strong>
                        <p>Recommended when the navigator should control visible marks across the dashboard.</p>
                    </div>
                <Checkbox
                    disabled={!worksheetsWithFields.length}
                    checked={props.data.worksheet.filterEnabled}
                    onChange={props.changeEnabled}
                    data-type='filter'
                    aria-label='Apply selection as a filter'
                />
                </div>
                {props.data.worksheet.filterEnabled?
                    <div className='config-filter-targets config-revealed-options'>
                        {targets.map((target, index) => {
                            const targetItems=props.data.dashboardItems.allWorksheetItems[target.worksheetName];
                            const targetFields=targetItems?Array.from(new Set(targetItems.fields.concat(targetItems.filters))):[];
                            const worksheetChoices=worksheetsWithFields.filter(name => name===target.worksheetName||!usedWorksheetNames.has(name));
                            return (
                                <div className='config-filter-target' key={`${target.worksheetName}-${index}`}>
                                    <div className='config-filter-target-heading'>
                                        <strong>Filter target {index+1}</strong>
                                        <Button
                                            kind='lowEmphasis'
                                            density='high'
                                            onClick={() => props.setUpdates({ type: 'REMOVE_FILTER_TARGET', data: { index } })}
                                        >Remove</Button>
                                    </div>
                                    <div className='config-field-grid config-field-grid--two'>
                                        <Selector
                                            title='Target worksheet'
                                            description='A worksheet that should react to hierarchy selections.'
                                            required={true}
                                            status={worksheetChoices.length?Status.set:Status.notpossible}
                                            list={worksheetChoices}
                                            selected={target.worksheetName}
                                            onChange={(event) => props.setUpdates({
                                                type: 'SET_FILTER_TARGET_WORKSHEET',
                                                data: { index, worksheetName: event.target.value }
                                            })}
                                        />
                                        <Selector
                                            title='Target filter field'
                                            description='The field whose values match the selected hierarchy IDs.'
                                            required={true}
                                            status={targetFields.length?Status.set:Status.notpossible}
                                            list={targetFields}
                                            selected={target.fieldName}
                                            onChange={(event) => props.setUpdates({
                                                type: 'SET_FILTER_TARGET_FIELD',
                                                data: { index, fieldName: event.target.value }
                                            })}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                        {!targets.length&&
                            <p className='config-muted-note'>Add at least one worksheet to enable dashboard filtering.</p>
                        }
                        <div className='config-add-target'>
                            <Button
                                kind='outline'
                                disabled={!availableWorksheetNames.length}
                                onClick={() => props.setUpdates({ type: 'ADD_FILTER_TARGET', data: {} })}
                            >Add another worksheet</Button>
                            {!availableWorksheetNames.length&&targets.length>0&&
                                <span>All available worksheets are already configured.</span>
                            }
                        </div>
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
