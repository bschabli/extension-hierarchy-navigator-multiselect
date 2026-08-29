import React from 'react';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
    closeLabel?: string;
    color?: 'danger'|'primary'|'warning';
    isOpen?: boolean;
    toggle?: () => void;
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    density?: 'high'|'low';
    kind?: 'filledGreen'|'lowEmphasis'|'outline'|'primary';
}

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {}

export interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
    kind?: 'line'|'outline'|'search';
    label?: React.ReactNode;
    message?: React.ReactNode;
    onClear?: () => void;
    valid?: boolean;
}

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: React.ReactNode;
    message?: React.ReactNode;
    valid?: boolean;
}

export interface DropdownSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    kind?: 'line'|'outline';
    label?: React.ReactNode;
}

export interface StepperProps {
    floatingPoint?: boolean;
    max?: number;
    min?: number;
    onValueChange: (value: number) => void;
    pageSteps?: number;
    step?: number;
    value: number;
}

/** Render a dismissible status message without a transition dependency. */
export function Alert(props: AlertProps) {
    const {
        children,
        className='',
        closeLabel='Close',
        color='primary',
        isOpen=true,
        role=color==='primary'?'status':'alert',
        toggle,
        ...alertProps
    }=props;
    if(!isOpen) { return null; }
    return (
        <div
            {...alertProps}
            className={`alert alert-${ color } ${ toggle?'alert-dismissible':'' } ${ className }`}
            role={role}
        >
            {children}
            {toggle&&
                <button className='ui-alert-close' type='button' onClick={toggle} aria-label={closeLabel}>×</button>
            }
        </div>
    );
}

/** Render a dependency-free button with the visual variants used by the extension. */
export function Button(props: ButtonProps) {
    const { className='', density, kind='outline', type='button', ...buttonProps }=props;
    const classes=[
        'ui-button',
        `ui-button--${ kind }`,
        density?`ui-button--density-${ density }`:'',
        className
    ].filter(Boolean).join(' ');
    return <button {...buttonProps} className={classes} type={type} />;
}

/** Render a labeled native checkbox while preserving the input as the event target. */
export function Checkbox(props: CheckboxProps) {
    const { children, className='', ...inputProps }=props;
    return (
        <label className={`ui-checkbox ${ className }`}>
            <input {...inputProps} type='checkbox' />
            {typeof children!=='undefined'&&<span>{children}</span>}
        </label>
    );
}

/** Render the text and search inputs used by the configuration and hierarchy UI. */
export function TextField(props: TextFieldProps) {
    const generatedId=React.useId();
    const {
        className='',
        kind='line',
        label,
        message,
        onClear,
        style,
        valid,
        value,
        ...inputProps
    }=props;
    const inputId=inputProps.id||generatedId;
    const hasValue=typeof value==='string'?value.length>0:typeof value!=='undefined'&&value!==null;
    return (
        <div
            className={`ui-field-control ui-field-control--${ kind } ${ valid===false?'ui-field-control--invalid':'' } ${ className }`}
        >
            {label&&<label className='ui-field-label' htmlFor={inputId}>{label}</label>}
            <div className='ui-input-shell'>
                <input {...inputProps} id={inputId} style={style} type={kind==='search'?'search':'text'} value={value} />
                {onClear&&hasValue&&
                    <button className='ui-input-clear' type='button' onClick={onClear} aria-label='Clear'>×</button>
                }
            </div>
            {message&&<div className='ui-field-message'>{message}</div>}
        </div>
    );
}

/** Render a labeled native textarea. */
export function TextArea(props: TextAreaProps) {
    const generatedId=React.useId();
    const { className='', label, message, style, valid, ...textAreaProps }=props;
    const inputId=textAreaProps.id||generatedId;
    return (
        <div
            className={`ui-field-control ${ valid===false?'ui-field-control--invalid':'' } ${ className }`}
        >
            {label&&<label className='ui-field-label' htmlFor={inputId}>{label}</label>}
            <textarea {...textAreaProps} id={inputId} style={style} />
            {message&&<div className='ui-field-message'>{message}</div>}
        </div>
    );
}

/** Render a labeled native select element. */
export function DropdownSelect(props: DropdownSelectProps) {
    const generatedId=React.useId();
    const { children, className='', kind: _kind, label, ...selectProps }=props;
    const inputId=selectProps.id||generatedId;
    return (
        <div className={`ui-field-control ${ className }`}>
            {label&&<label className='ui-field-label' htmlFor={inputId}>{label}</label>}
            <select {...selectProps} id={inputId}>{children}</select>
        </div>
    );
}

/** Render a bounded numeric input for millisecond settings. */
export function Stepper(props: StepperProps) {
    const handleChange=(event: React.ChangeEvent<HTMLInputElement>): void => {
        const nextValue=Number(event.target.value);
        if(Number.isFinite(nextValue)) {
            const roundedValue=props.floatingPoint?nextValue:Math.round(nextValue);
            const minimum=typeof props.min==='number'?props.min:Number.NEGATIVE_INFINITY;
            const maximum=typeof props.max==='number'?props.max:Number.POSITIVE_INFINITY;
            props.onValueChange(Math.min(maximum, Math.max(minimum, roundedValue)));
        }
    };
    return (
        <input
            className='ui-stepper'
            type='number'
            min={props.min}
            max={props.max}
            step={props.step}
            value={props.value}
            onChange={handleChange}
        />
    );
}
