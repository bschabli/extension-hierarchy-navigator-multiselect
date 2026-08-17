import { TextField, TextFieldProps } from '@tableau/tableau-ui';
import { InputAttrs } from '@tableau/tableau-ui/lib/src/utils/NativeProps';
import {arrayMoveImmutable} from 'array-move';
import React, { useEffect, useState } from 'react';
import { SortableContainer, SortableElement } from 'react-sortable-hoc';
import { Button as RSButton } from 'reactstrap';
import dragHandle from '../../images/Drag-handle-01.png';  //'. /src/images/Drag-handle-01.png';
import { HierarchyProps, Status } from '../API/Interfaces';
import { withHTMLSpaces } from '../API/Utils';
import { useTranslation } from '../localization/I18n';
import { Selector } from '../shared/Selector';
import { ConfigSection, ConfigStatus, ConfigStepIntro } from './ConfigPrimitives';
const extend=require('extend');

interface Props {
    data: HierarchyProps;
    setUpdates: (obj: { type: string, data: any; }) => void;
    onClear?: () => void;
    setCurrentWorksheetName: (s: string) => void;
}

export function Page2Flat(props: Props) {
    const {t}=useTranslation();
    // availFields are fields on worksheet that are not added to hierarchy (aka worksheet.fields); used for childID selector
    const [availFields, setAvailFields]=useState<string[]>([]);
    // sans child is all available fields except child id field; used for left ul
    const [availFieldsSansChildId, setAvailFieldsSansChildId]=useState<string[]>([]);
    const { fields: allFields }=props.data.dashboardItems.allCurrentWorksheetItems;

    useEffect(() => {
        const avail: string[]=[];
        const sansChildId: string[]=[];
        // tslint:disable prefer-for-of
        for(let i=0;i<allFields.length;i++) {
            if(!props.data.worksheet.fields.includes(allFields[i])) {
                avail.push(allFields[i]);
                if(allFields[i]!==props.data.worksheet.childId) {
                    sansChildId.push(allFields[i]);
                }
            }
        }
        // tslint:enable prefer-for-of
        setAvailFields(avail);
        setAvailFieldsSansChildId(sansChildId);
    }, [props.data.worksheet.fields, props.data.worksheet.childId]);

    // Handles selection in worksheet selection dropdown
    const worksheetChange=(e: React.ChangeEvent<HTMLSelectElement>): void => {
        props.setCurrentWorksheetName(e.target.value);
    };

    const setChild=(e: React.ChangeEvent<HTMLSelectElement>): void => {
        props.setUpdates({ type: 'SET_CHILD_ID_FIELD', data: e.target.value });
    };


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
    const DragHandle=(() => <img src={dragHandle} width='20px' height='20px' alt='' />);
    const SortableItem=SortableElement(({ value }: any) => <li value={value} className='config-sortable-item'>
        <span className='config-drag-handle' title={t('Drag to reorder')}><DragHandle /></span>
        <span>{withHTMLSpaces(value)}</span>
        <RSButton value={value} onClick={removeFromList} color='link' size='sm' aria-label={t('Remove {label}', { label: withHTMLSpaces(value) })}>{t('Remove')}</RSButton>
    </li>);

    const SortableList=SortableContainer(({ items }: any) => {
        if(!items) { return (<li>{t('No items')}</li>); }
        return (
            <ul className='sortableList'>
                {items.map((value: any, index: any) => (
                    <SortableItem key={`item-${ value }`} index={index} value={value} />
                ))}
            </ul>
        );
    });

    const StaticFieldsItem=SortableElement(({ value }: any) => <li value={value} className='config-sortable-item'>
        <span>{withHTMLSpaces(value)}</span>
        <RSButton value={value} onClick={addToList} color='link' size='sm'>{t('Add')}</RSButton>
    </li>);

    const StaticFieldsList=SortableContainer(({ items }: any) => {
        if(!items) { return (<li>{t('No items')}</li>); }
        return (
            <ul className='sortableList'>
                {items.map((value: any, index: any) => (
                    <StaticFieldsItem key={`item-${ value }`} index={index} value={value} disabled={true}/>
                ))}
            </ul>
        );
    });

    // sort lists
    const onSortEnd=({ oldIndex, newIndex }: any) => {
        const newOrder=arrayMoveImmutable(props.data.worksheet.fields, oldIndex, newIndex);
        props.setUpdates({ type: 'SET_FIELDS', data: newOrder });
    };

    // remove from list
    const removeFromList=(evt: any) => {
        const filteredItems=props.data.worksheet.fields.filter((item: string) => {
            return item!==evt.target.value;
        }
        );
        props.setUpdates({ type: 'SET_FIELDS', data: filteredItems });
    };

    // add to list
    const addToList=(evt?: any) => {
        const fields: string[]=extend(true, [], props.data.worksheet.fields);
        if(evt.target&&evt.target.value) {
            fields.push(evt.target.value);
        }
        else {
            allFields.forEach(el => {
                if(fields.indexOf(el)===-1&&el!==props.data.worksheet.childId) {
                    fields.push(el);
                }
            });
        }
        props.setUpdates({ type: 'SET_FIELDS', data: fields });
    };
    const inputProps: TextFieldProps & InputAttrs & React.RefAttributes<HTMLInputElement>={
        message: undefined,
        kind: 'line' as 'line'|'outline'|'search',
        label: t('Path separator'),
        onChange: (e: any) => {
            props.setUpdates({ type: 'SET_SEPARATOR', data: e.target.value });
        },
        onClear: () => {
            props.setUpdates({ type: 'SET_SEPARATOR', data: '|' });
        },
        style: { width: '100%' },
        value: props.data.separator,
    };

    const formula=() => {
        let f='';
        for(let i=0;i<props.data.worksheet.fields.length;i++) {
            f+=`[${ withHTMLSpaces(props.data.worksheet.fields[i]) }]`;
            if(i<props.data.worksheet.fields.length-1) {
                f+=`+'${ props.data.separator }'+`;
            }
        }
        return f;
    };

    return (
        <div className='config-page'>
            <ConfigStepIntro
                eyebrow={t('Step {current} of {total}', { current: 2, total: 4 })}
                title={t('Map the source worksheet')}
                description={t('Choose the hierarchy worksheet, then build the hierarchy from broadest level to most detailed level.')}
            />
            <ConfigSection
                title={t('Source worksheet')}
                description={t('This worksheet supplies the hierarchy values. It may be hidden on the finished dashboard.')}
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
                title={t('Hierarchy levels')}
                description={t('Add fields to the left column and drag them into order. Start with the root level.')}
            >
                <div className='config-field-order'>
                    <div className='config-field-list config-field-list--selected'>
                        <div className='config-field-list-heading'>
                            <strong>{t('Selected levels')}</strong>
                            <span>{props.data.worksheet.fields.length}</span>
                        </div>
                        {props.data.worksheet.fields&&props.data.worksheet.fields.length?
                            <SortableList
                                items={props.data.worksheet.fields}
                                onSortEnd={onSortEnd}
                                lockAxis='y'
                                helperClass='draggingSort'
                            />:
                            <p className='config-empty-state'>{t('No levels selected yet.')}</p>
                        }
                    </div>
                    <div className='config-field-list'>
                        <div className='config-field-list-heading'>
                            <strong>{t('Available fields')}</strong>
                            <RSButton onClick={addToList} color='link' size='sm' disabled={!availFieldsSansChildId.length}>{t('Add all')}</RSButton>
                        </div>
                        {availFieldsSansChildId.length>0?
                            <StaticFieldsList items={availFieldsSansChildId} lockAxis='y' />:
                            <p className='config-empty-state'>{allFields.length?t('All available fields are selected.'):t('No fields available.')}</p>
                        }
                    </div>
                </div>
            </ConfigSection>
            <ConfigSection
                title={t('Unique path ID')}
                description={t('The extension uses one calculated field to distinguish identical labels that appear under different parents.')}
            >
                <div className='config-field-grid config-field-grid--two'>
                    <Selector
                        title={t('Unique path ID field')}
                        description={t('Choose the calculated field that contains the full hierarchy path.')}
                        required={true}
                        status={availFields.length>0? Status.set:Status.hidden}
                        list={availFields}
                        onChange={setChild}
                        selected={props.data.worksheet.childId}
                    />
                    <div className='config-text-field'><TextField {...inputProps} /></div>
                </div>
                <div className='config-formula'>
                    <strong>{t('Expected Tableau formula')}</strong>
                    <p>{t('Create or update {field} with this formula, then reopen configuration if needed.', {
                        field: withHTMLSpaces(props.data.worksheet.childId)||t('the ID field')
                    })}</p>
                    <code>{formula()||t('Select at least one hierarchy level to generate the formula.')}</code>
                </div>
                <div className='config-inline-status'>
                    <ConfigStatus
                        complete={Boolean(props.data.worksheet.name&&props.data.worksheet.childId&&props.data.worksheet.fields.length)}
                        completeLabel={t('Required source fields are mapped')}
                        incompleteLabel={t('Choose a worksheet, at least one level, and an ID field')}
                    />
                </div>
            </ConfigSection>
        </div>);
}
