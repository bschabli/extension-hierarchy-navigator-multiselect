import * as React from 'react';
import '../../css/style.css';
import {Status} from '../API/Interfaces';
import {withHTMLSpaces} from '../API/Utils';
import { useTranslation } from '../localization/I18n';
import { Button, ButtonProps, DropdownSelect, DropdownSelectProps } from './UiComponents';
import { isSelectorUnavailable } from './SelectorState';
export interface SelectorProps {
    title?: string;
    description?: string;
    required?: boolean;
    status?: Status;
    list: string[];
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    onClick?: () => void;
    selected?: string;  
    type?: string
}

// Shows if setting has not yet been configured
export const Selector: React.FC<SelectorProps> = (props) => {
    const {t}=useTranslation();
    const inputId=React.useId();
    const accessibleName=props.title||props.description||t('Select an option');
    const unavailable=isSelectorUnavailable(props.status);
    const dropdownSelectProps: DropdownSelectProps = {
        className: 'dropdown-select',
        disabled: unavailable,
        id: inputId,
        kind: 'line',
        onChange: props.onChange,
        value: props.selected,
    };
    const buttonProps: ButtonProps = {
        disabled: unavailable,
        kind: 'filledGreen',
        onClick: props.onClick,
        style: { marginTop: '8px' },
    };
    const showButton = ():React.ReactNode => {
        if (typeof props.onClick === 'function'){
            return (<Button {...buttonProps}>{t('Set')}</Button>);
        }
        else {
            return (<div />)
        }
    }

    
    if (props.status === Status.hidden){
        return (<div />)
    }
    else {
    return (
        <div className='config-field'>
            {props.title&&
                <label className='config-field-label' htmlFor={inputId}>
                    {props.title}
                    {props.required&&<span className='config-required'>{t('Required')}</span>}
                </label>
            }
            {props.description&&<p className='config-field-help'>{props.description}</p>}
            <DropdownSelect
                {...dropdownSelectProps}
                data-type={props.type}
                aria-label={accessibleName}
                aria-required={props.required||undefined}
            >
                {props.list.map(option => <option key={option} value={option}>{withHTMLSpaces(option)}</option>)}
            </DropdownSelect>
            {showButton()}
        </div>
    );
    }
};
