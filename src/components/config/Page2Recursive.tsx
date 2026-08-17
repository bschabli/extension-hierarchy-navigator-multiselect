import React from 'react';
import { Selector } from '../shared/Selector';
import { HierarchyProps, Status } from '../API/Interfaces';
import { useTranslation } from '../localization/I18n';
import { ConfigSection, ConfigStatus, ConfigStepIntro } from './ConfigPrimitives';

interface Props {
    data: HierarchyProps;
    setUpdates: (obj: { type: string, data: any; }) => void;
    setCurrentWorksheetName: (s: string) => void;
}
export function Page2Recursive(props: Props) {
    const {t}=useTranslation();

    const worksheetTitle=() => {
        switch(props.data.worksheet.status) {
            case Status.notpossible:
                return t('No valid sheets on the dashboard');
            case Status.set:
            case Status.notset:
                return t('Select the sheet with the hierarchy data');
            default:
                return '';
        }
    };

    // Handles selection of the parentid field
    const setParent=(e: React.ChangeEvent<HTMLSelectElement>): void => {
        props.setUpdates({ type: 'SET_PARENT_ID_FIELD', data: e.target.value });
    };

    // Handles selection in worksheet selection dropdown
    const worksheetChange=(e: React.ChangeEvent<HTMLSelectElement>): void => {
        props.setCurrentWorksheetName(e.target.value);
    };

    const setChild=(e: React.ChangeEvent<HTMLSelectElement>): void => {
        props.setUpdates({ type: 'SET_CHILD_ID_FIELD', data: e.target.value });
    };

    // Handles selection of the label field
    const setChildLabel=(e: React.ChangeEvent<HTMLSelectElement>): void => {
        props.setUpdates({ type: 'SET_CHILD_LABEL_FIELD', data: e.target.value });
    };

    return (
        <div className='config-page'>
            <ConfigStepIntro
                eyebrow={t('Step {current} of {total}', { current: 2, total: 4 })}
                title={t('Map the source worksheet')}
                description={t('Tell the navigator which row identifies a hierarchy item, which row is its parent, and what users should see.')}
            />
            <ConfigSection
                title={t('Source worksheet')}
                description={t('Choose the dedicated worksheet that contains the parent-and-child relationship.')}
            >
                <Selector
                    title={worksheetTitle()}
                    status={props.data.worksheet.status}
                    selected={props.data.worksheet.name}
                    list={props.data.dashboardItems.worksheets}
                    onChange={worksheetChange}
                    required={true}
                />
            </ConfigSection>
            <ConfigSection
                title={t('Field mapping')}
                description={t('Each ID should uniquely identify a node. The label is the friendly name shown in the navigator.')}
            >
                <div className='config-field-grid'>
                    <Selector
                        title={t('Parent ID field')}
                        description={t('The ID of this row’s direct parent. Root rows may be null.')}
                        required={true}
                        status={props.data.worksheet.status!==Status.set? Status.hidden:props.data.worksheet.status}
                        list={props.data.dashboardItems.allCurrentWorksheetItems.fields}
                        onChange={setParent}
                        selected={props.data.worksheet.parentId}
                    />
                    <Selector
                        title={t('Child ID field')}
                        description={t('A stable, unique ID for each hierarchy item.')}
                        required={true}
                        status={props.data.worksheet.status!==Status.set? Status.hidden:props.data.worksheet.status}
                        list={props.data.dashboardItems.allCurrentWorksheetItems.fields}
                        onChange={setChild}
                        selected={props.data.worksheet.childId}
                    />
                    <Selector
                        title={t('Display label field')}
                        description={t('The text users will see next to each checkbox.')}
                        required={true}
                        status={props.data.worksheet.status!==Status.set? Status.hidden:props.data.worksheet.status}
                        list={props.data.dashboardItems.allCurrentWorksheetItems.fields}
                        onChange={setChildLabel}
                        selected={props.data.worksheet.childLabel}
                    />
                </div>
                <div className='config-inline-status'>
                    <ConfigStatus
                        complete={Boolean(props.data.worksheet.name&&props.data.worksheet.parentId&&props.data.worksheet.childId&&props.data.worksheet.childLabel)}
                        completeLabel={t('Required source fields are mapped')}
                        incompleteLabel={t('Map all required fields to continue')}
                    />
                </div>
            </ConfigSection>
        </div>
    );


}
