import React from 'react';
import { resolveFilterTargetsExcludingWorksheet, resolveFilterValueSource } from '../API/FilterTargets';
import { HierarchyProps, HierType, Status } from '../API/Interfaces';
import { useTranslation } from '../localization/I18n';
import { Selector } from '../shared/Selector';
import { ConfigSection } from './ConfigPrimitives';
import { Button, Checkbox, DropdownSelect } from '../shared/UiComponents';
import { NormalizedTreeNode } from '../extension/TreeModel';
import { getHierarchyDepth } from '../extension/FilterTargetValues';
import { TargetFilterCompatibility } from './TargetFilterCompatibility';

interface Props {
    changeEnabled: (event: React.MouseEvent<HTMLInputElement, MouseEvent>|React.ChangeEvent<HTMLInputElement>) => void;
    data: HierarchyProps;
    previewTree?: NormalizedTreeNode[];
    setUpdates: (update: { type: string, data: any }) => void;
}

/** Render the shared target worksheet/filter configuration for both modes. */
export function TargetFilterControls(props: Props) {
    const {t}=useTranslation();
    const targets=resolveFilterTargetsExcludingWorksheet(props.data.worksheet, props.data.worksheet.name);
    const usedWorksheetNames=new Set(targets.map(target => target.worksheetName));
    const worksheetsWithFields=props.data.dashboardItems.targetWorksheets.filter(name => {
        if(name===props.data.worksheet.name) { return false; }
        const items=props.data.dashboardItems.allWorksheetItems[name];
        return Boolean(items&&(items.fields.length||items.filters.length));
    });
    const availableWorksheetNames=worksheetsWithFields.filter(name => !usedWorksheetNames.has(name));
    const otherWorksheetNames=Object.keys(props.data.dashboardItems.allWorksheetItems).filter(
        name => name!==props.data.worksheet.name
    );
    const recursiveLevelCount=Math.max(1, getHierarchyDepth(props.previewTree||[]));
    const levelOptions=props.data.type===HierType.FLAT?
        props.data.worksheet.fields.map((fieldName, index) => ({
            label: t('Level {count}: {field}', { count: index+1, field: fieldName }),
            value: index
        })):
        Array.from({ length: recursiveLevelCount }, (_unused, index) => ({
            label: t('Level {count}', { count: index+1 }),
            value: index
        }));

    return (
        <>
            <ConfigSection
                title={t('Filter dashboard worksheets')}
                description={t('Apply selected hierarchy values to one or more worksheets. Each target can use its own field and value mapping.')}
            >
                <div className='config-option-row'>
                    <div>
                        <strong>{t('Apply selection as filters')}</strong>
                        <p>{t('Recommended when the navigator should control visible marks across the dashboard.')}</p>
                    </div>
                <Checkbox
                    disabled={!worksheetsWithFields.length}
                    checked={props.data.worksheet.filterEnabled}
                    onChange={props.changeEnabled}
                    data-type='filter'
                    aria-label={t('Apply selection as a filter')}
                />
                </div>
                {!worksheetsWithFields.length&&
                    <div className='config-unavailable-note' role='status'>
                        <strong>{t('Dashboard filtering is unavailable')}</strong>
                        <span>{otherWorksheetNames.length?
                            t('Other worksheets were found, but none exposes a string or integer field that can be filtered. Add the matching field to Detail or Filters in Tableau, then reopen configuration.'):
                            t('Add at least one other worksheet to the dashboard. The hierarchy source worksheet is intentionally excluded from filter targets.')
                        }</span>
                    </div>
                }
                {props.data.worksheet.filterEnabled?
                    <div className='config-filter-targets config-revealed-options'>
                        {targets.map((target, index) => {
                            const targetItems=props.data.dashboardItems.allWorksheetItems[target.worksheetName];
                            const targetFields=targetItems?Array.from(new Set(targetItems.fields.concat(targetItems.filters))):[];
                            const worksheetChoices=worksheetsWithFields.filter(name => name===target.worksheetName||!usedWorksheetNames.has(name));
                            return (
                                <div className='config-filter-target' key={`${target.worksheetName}-${index}`}>
                                    <div className='config-filter-target-heading'>
                                        <strong>{t('Filter target {count}', { count: index+1 })}</strong>
                                        <Button
                                            kind='lowEmphasis'
                                            density='high'
                                            onClick={() => props.setUpdates({ type: 'REMOVE_FILTER_TARGET', data: { index } })}
                                        >{t('Remove')}</Button>
                                    </div>
                                    <div className='config-field-grid config-field-grid--two'>
                                        <Selector
                                            title={t('Target worksheet')}
                                            description={t('A worksheet that should react to hierarchy selections.')}
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
                                            title={t('Target filter field')}
                                            description={t('The field whose values match the source value chosen below.')}
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
                                    <div className='config-filter-value-mapping'>
                                        <DropdownSelect
                                            label={t('Value sent to this field')}
                                            value={resolveFilterValueSource(target.valueSource)}
                                            onChange={event => props.setUpdates({
                                                type: 'SET_FILTER_TARGET_VALUE_SOURCE',
                                                data: { index, valueSource: event.target.value }
                                            })}
                                        >
                                            <option value='id'>{t('Unique hierarchy ID')}</option>
                                            <option value='label'>{t('Visible item label')}</option>
                                            <option value='path'>{t('Full hierarchy path')}</option>
                                            <option value='level'>{t('Specific hierarchy level')}</option>
                                        </DropdownSelect>
                                        {resolveFilterValueSource(target.valueSource)==='level'&&
                                            <DropdownSelect
                                                label={t('Hierarchy level')}
                                                value={target.levelIndex||0}
                                                onChange={event => props.setUpdates({
                                                    type: 'SET_FILTER_TARGET_LEVEL',
                                                    data: { index, levelIndex: Number(event.target.value) }
                                                })}
                                            >
                                                {levelOptions.map(option =>
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                )}
                                            </DropdownSelect>
                                        }
                                    </div>
                                    <p className='config-field-help'>{t('Each target can receive IDs, labels, complete paths, or values from one hierarchy level.')}</p>
                                    <TargetFilterCompatibility
                                        previewTree={props.previewTree}
                                        selectionBehavior={props.data.options.selectionBehavior}
                                        separator={props.data.separator}
                                        target={target}
                                    />
                                </div>
                            );
                        })}
                        {!targets.length&&
                            <p className='config-muted-note'>{t('Add at least one worksheet to enable dashboard filtering.')}</p>
                        }
                        <div className='config-add-target'>
                            <Button
                                kind='outline'
                                disabled={!availableWorksheetNames.length}
                                onClick={() => props.setUpdates({ type: 'ADD_FILTER_TARGET', data: {} })}
                            >{t('Add another worksheet')}</Button>
                            {!availableWorksheetNames.length&&targets.length>0&&
                                <span>{t('All available worksheets are already configured.')}</span>
                            }
                        </div>
                    </div>:
                    <p className='config-muted-note'>{t('Filtering is off. The navigator will keep its selection internally unless another output below is enabled.')}</p>
                }
            </ConfigSection>
            <ConfigSection
                title={t('Select marks on the source worksheet')}
                description={t('Visually select the matching marks in the hierarchy source worksheet. This is separate from filtering a target worksheet.')}
                optional={true}
            >
                <div className='config-option-row'>
                    <div>
                        <strong>{t('Enable source mark selection')}</strong>
                        <p>{t('Useful for dashboard actions that start from selected marks on the source sheet.')}</p>
                    </div>
                <Checkbox
                    checked={props.data.worksheet.enableMarkSelection}
                    onChange={props.changeEnabled}
                    data-type='mark'
                    aria-label={t('Enable source mark selection')}
                />
                </div>
            </ConfigSection>
        </>
    );
}
