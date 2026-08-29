import React, { useEffect, useState } from 'react';
import { normalizeItemCss, parseItemCss } from '../API/ConfigurationModel';
import { resolveFilterTargetsExcludingWorksheet } from '../API/FilterTargets';
import { defaultSelectedProps, HierarchyProps, HierType } from '../API/Interfaces';
import { SelectionBehavior, getSelectionBehaviorLabel } from '../API/SelectionBehavior';
import { useTranslation } from '../localization/I18n';
import {
    Checkbox,
    DropdownSelect,
    DropdownSelectProps,
    Stepper,
    TextArea,
    TextAreaProps,
    TextField,
    TextFieldProps
} from '../shared/UiComponents';
import { ConfigSection, ConfigStatus, ConfigStepIntro } from './ConfigPrimitives';
import { DataValidationPreview } from './DataValidationPreview';
import { HierarchyPreview } from './HierarchyPreview';
import { HierarchyValidationState } from './useHierarchyValidation';

interface Props {
    data: HierarchyProps;
    onRetryValidation: () => void;
    setUpdates: (obj: { type: string, data: any; }) => void;
    validation: HierarchyValidationState;
}

export function Page4(props: Props) {
    const {t}=useTranslation();
    const setTitleInputProps: TextFieldProps & React.RefAttributes<HTMLInputElement> = {
        disabled: !props.data.options.titleEnabled,
        label: t('Title text'),
        message: undefined,
        kind: 'line' as 'line' | 'outline' | 'search',
        onChange: (e: any) => {
            props.setUpdates({ type: 'SET_TITLE', data: e.target.value });
        },
        onClear: () => {
            props.setUpdates({ type: 'SET_TITLE', data: 'Hierarchy Navigator' });
        },
        style: { paddingLeft: '9px' },
        value: props.data.options.title
    };
    const setFontFamilyInputProps: TextAreaProps & React.RefAttributes<HTMLTextAreaElement> = {
        label: t('Font family'),
        message: undefined,
        onChange: (e: any) => {
            props.setUpdates({ type: 'SET_FONT_FAMILY', data: e.target.value });
        },
        style: { fontFamily: props.data.options.fontFamily, marginTop: '3px', width: '100%' },
        value: props.data.options.fontFamily,
        rows: 3
    };
    const setFontSizeInputProps: TextFieldProps & React.RefAttributes<HTMLInputElement> = {
        label: t('Font size'),
        message: undefined,
        kind: 'line' as 'line' | 'outline' | 'search',
        onChange: (e: any) => {
            props.setUpdates({ type: 'SET_FONT_SIZE', data: e.target.value });
        },
        onClear: () => {
            props.setUpdates({ type: 'SET_FONT_SIZE', data: '12px' });
        },
        style: { paddingLeft: '9px' },
        value: props.data.options.fontSize
    };
    const safeItemCss=normalizeItemCss(props.data.options.itemCSS, defaultSelectedProps.options.itemCSS);
    const [itemCSS, setItemCSS] = useState(JSON.stringify(safeItemCss));
    const [itemCSSValid, setItemCSSValid] = useState(true);
    const [itemCSSMessage, setItemCSSMessage] = useState(<br />)
    const setItemCSSInputProps: TextAreaProps & React.RefAttributes<HTMLTextAreaElement> = {
        label: t('CSS for items'),
        message: itemCSSValid ? <br /> : itemCSSMessage,
        valid: itemCSSValid ? undefined : itemCSSValid,
        onChange: (e: any) => {
            setItemCSS(e.target.value);
            try {
                const json=parseItemCss(e.target.value);
                props.setUpdates({ type: 'SET_ITEM_CSS', data: json });

                setItemCSSMessage(<br />);
                setItemCSSValid(true);
            }
            catch (err) {
                setItemCSSValid(false);
                setItemCSSMessage(<>{t('Invalid JSON: {message}', { message: err.message })}</>);
            }
        },

        style: { width: '100%' },
        value: itemCSS,
        rows: 3
    };


    const defaultClosedIcon = <svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'>
        <path fill={props.data.options.fontColor} fillRule='evenodd' d='M12.7632424,18.2911068 L24.112,6.942 L22.698,5.528 L12.0561356,16.1697864 L1.414,5.528 L8.52651283e-14,6.942 L11.3490288,18.2911068 C11.7395531,18.6816311 12.3727181,18.6816311 12.7632424,18.2911068 Z' transform='matrix(0 1 1 0 0 0)' /> </svg>;

    const defaultOpenedIcon = <svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'>
        <path fill={props.data.options.fontColor} fillRule='evenodd' d='M12.7632424,17.6209712 L24.112,6.27186438 L22.698,4.85786438 L12.0561356,15.4996508 L1.414,4.85786438 L4.08562073e-14,6.27186438 L11.3490288,17.6209712 C11.7395531,18.0114954 12.3727181,18.0114954 12.7632424,17.6209712 Z' /></svg>;

    const [openedIconPreview, setOpenedIconPreview] = useState<any>(defaultOpenedIcon)
    const [closedIconPreview, setClosedIconPreview] = useState<any>(defaultClosedIcon)
    const items = [
        { value: 'Default' },
        { value: 'Base64 Image' },
        { value: 'Ascii' }
    ]
    const makeOption = (item: any, index: number) => <option disabled={item.disabled || item.separator} key={index} value={item.value}>{t(item.value)}</option>;
    const [openedIconState, setOpenedIconState] = useState({ value: props.data.options.openedIconType });
    const [closedIconState, setClosedIconState] = useState({ value: props.data.options.closedIconType });
    const setOpenedIconInputProps: TextAreaProps & React.RefAttributes<HTMLTextAreaElement> = {
        label: props.data.options.openedIconType === 'Default' ? undefined : props.data.options.openedIconType === 'Base64 Image' ? t('Paste a Base64 image string below') : t('Use any ASCII character(s)'),
        onChange: (e: any) => {
            if (props.data.options.openedIconType === 'Base64 Image') {
                props.setUpdates({ type: 'SET_OPENED_ICON_BASE64IMAGE', data: e.target.value });
            }
            else if (props.data.options.openedIconType === 'Ascii') {
                props.setUpdates({ type: 'SET_OPENED_ICON_ASCII', data: e.target.value });
            }
        },
        style: { width: '100%', display: props.data.options.openedIconType === 'Default' ? 'none' : '' },
        value: props.data.options.openedIconType === 'Base64 Image' ? props.data.options.openedIconBase64Image : props.data.options.openedIconAscii,
        rows: props.data.options.openedIconType === 'Base64 Image' ? 3 : 1
    };
    const setClosedIconInputProps: TextAreaProps & React.RefAttributes<HTMLTextAreaElement> = {
        label: props.data.options.closedIconType === 'Default' ? undefined : props.data.options.closedIconType === 'Base64 Image' ? t('Paste a Base64 image string below') : t('Use any ASCII character(s)'),
        onChange: (e: any) => {
            if (props.data.options.closedIconType === 'Base64 Image') {
                props.setUpdates({ type: 'SET_CLOSED_ICON_BASE64IMAGE', data: e.target.value });
            }
            else if (props.data.options.closedIconType === 'Ascii') {
                props.setUpdates({ type: 'SET_CLOSED_ICON_ASCII', data: e.target.value });
            }
        },
        style: { width: '100%', display: props.data.options.closedIconType === 'Default' ? 'none' : '' },
        value: props.data.options.closedIconType === 'Base64 Image' ? props.data.options.closedIconBase64Image : props.data.options.closedIconAscii,
        rows: props.data.options.closedIconType === 'Base64 Image' ? 3 : 1
    };
    useEffect(() => {
        // set the preview image when the type is changed
        if (props.data.options.openedIconType === 'Default') {
            setOpenedIconPreview(defaultOpenedIcon);
        }
        else if (props.data.options.openedIconType === 'Base64 Image') {
            setOpenedIconPreview(<img src={props.data.options.openedIconBase64Image} width="12px" height="12px" alt='' />);
        }
        else if (props.data.options.openedIconType === 'Ascii') {
            setOpenedIconPreview(<span  style={{color: props.data.options.fontColor}}>{props.data.options.openedIconAscii}</span>);
        }
        if (props.data.options.closedIconType === 'Default') {
            setClosedIconPreview(defaultClosedIcon);
        }
        else if (props.data.options.closedIconType === 'Base64 Image') {
            setClosedIconPreview(<img src={props.data.options.closedIconBase64Image}width="12px" height="12px" alt='' />);
        }
        else if (props.data.options.closedIconType === 'Ascii') {
            setClosedIconPreview(<span  style={{color: props.data.options.fontColor}}>{props.data.options.closedIconAscii}</span>);
        }

    }, [props.data.options.openedIconType, props.data.options.closedIconType, props.data.options.openedIconBase64Image,props.data.options.closedIconBase64Image, props.data.options.openedIconAscii, props.data.options.closedIconAscii, props.data.options.fontColor]);
    const setOpenedIconInputPropsDropdown: DropdownSelectProps & React.RefAttributes<HTMLSelectElement> = {
        onChange: (e: any) => {
            setOpenedIconState({ value: e.target.value as 'Default' | 'Base64 Image' | 'Ascii' })
            props.setUpdates({ type: 'SET_OPENED_ICON_TYPE', data: e.target.value });
        },
        label: t('Open icon type'),
        kind: 'line'
    };
    const setClosedIconInputPropsDropdown: DropdownSelectProps & React.RefAttributes<HTMLSelectElement> = {
        onChange: (e: any) => {
            setClosedIconState({ value: e.target.value as 'Default' | 'Base64 Image' | 'Ascii' })
            props.setUpdates({ type: 'SET_CLOSED_ICON_TYPE', data: e.target.value });
        },
        label: t('Closed icon type'),
        kind: 'line'
    };
    const setBGColorInputProps: TextFieldProps & React.RefAttributes<HTMLInputElement> = {
        label: t('Background color'),
        message: undefined,
        kind: 'line' as 'line' | 'outline' | 'search',
        onChange: (e: any) => {
            props.setUpdates({ type: 'SET_BG_COLOR', data: e.target.value });
        },
        onClear: () => {
            props.setUpdates({ type: 'SET_BG_COLOR', data: '#F3F3F3' });
        },
        style: { paddingLeft: '9px' },
        value: props.data.options.bgColor
    };
    const setFontColorInputProps: TextFieldProps & React.RefAttributes<HTMLInputElement> = {
        label: t('Font color'),
        message: undefined,
        kind: 'line' as 'line' | 'outline' | 'search',
        onChange: (e: any) => {
            props.setUpdates({ type: 'SET_FONT_COLOR', data: e.target.value });
        },
        onClear: () => {
            props.setUpdates({ type: 'SET_FONT_COLOR', data: 'rgba(0, 0, 0, 0.8)' });
        },
        style: { paddingLeft: '9px' },
        value: props.data.options.fontColor
    };
    const setHighlightColorInputProps: TextFieldProps & React.RefAttributes<HTMLInputElement> = {
        label: t('Highlight color'),
        message: undefined,
        kind: 'line' as 'line' | 'outline' | 'search',
        onChange: (e: any) => {
            props.setUpdates({ type: 'SET_HIGHLIGHT_COLOR', data: e.target.value });
        },
        onClear: () => {
            props.setUpdates({ type: 'SET_HIGHLIGHT_COLOR', data: '#d1d1d1' });
        },
        style: { paddingLeft: '9px' },
        value: props.data.options.highlightColor
    };
    const changeTitleEnabled = (e: React.ChangeEvent<HTMLInputElement>): void => {
        props.setUpdates({ type: 'TOGGLE_TITLE_DISABLED', data: e.target.checked });
    };
    const changeSearch = (e: React.ChangeEvent<HTMLInputElement>): void => {
        props.setUpdates({ type: 'TOGGLE_SEARCH_DISPLAY', data: e.target.checked });
    };
    const changeSearchAutoExpand = (e: React.ChangeEvent<HTMLInputElement>): void => {
        props.setUpdates({ type: 'TOGGLE_SEARCH_AUTO_EXPAND', data: e.target.checked });
    };
    // Handles change in background color input
    const bgChange = (color: any): void => {
        props.setUpdates({ type: 'SET_BG_COLOR', data: color.target.value });

    };
    const fontColorChange = (color: any): void => {
        props.setUpdates({ type: 'SET_FONT_COLOR', data: color.target.value });
    };
    const highlightColorChange = (color: any): void => {
        props.setUpdates({ type: 'SET_HIGHLIGHT_COLOR', data: color.target.value });
    };
    const changeDebounce = (value: number): void => {
        props.setUpdates({ type: 'SET_DEBOUNCE', data: value });

    };
    const toggleDebug = (e: React.ChangeEvent<HTMLInputElement>): void => {
        props.setUpdates({ type: 'TOGGLE_DEBUG', data: e.target.checked });
    };
    const toggleDashboardListenersEnabled = (e: React.ChangeEvent<HTMLInputElement>): void => {
        props.setUpdates({ type: 'TOGGLE_DASHBOARD_LISTENERS', data: e.target.checked });
    };
    const sourceComplete=props.data.worksheet.name!==''&&props.data.worksheet.childId!==''&&(
        (props.data.type===HierType.FLAT&&props.data.worksheet.fields.length>0)||
        (props.data.type===HierType.RECURSIVE&&props.data.worksheet.parentId!==''&&props.data.worksheet.childLabel!=='')
    );
    const hierarchyFields=props.data.type===HierType.FLAT?
        props.data.worksheet.fields.join(' → '):
        `${props.data.worksheet.parentId||t('Parent ID')} → ${props.data.worksheet.childId||t('Child ID')}`;
    const parameterEnabled=props.data.parameters.childIdEnabled||props.data.parameters.childLabelEnabled;
    const selectionBehaviorLabel=t(getSelectionBehaviorLabel(
        props.data.options.selectionBehavior||SelectionBehavior.TERMINAL
    ));
    const filterTargets=resolveFilterTargetsExcludingWorksheet(props.data.worksheet, props.data.worksheet.name);
    const filterSummary=props.data.worksheet.filterEnabled&&filterTargets.length?
        `${ t(filterTargets.length===1?'{count} worksheet':'{count} worksheets', { count: filterTargets.length }) } · ${filterTargets.map(target => target.worksheetName).join(', ')}`:
        t('Off');
    const validationPassed=props.validation.status==='complete'&&Boolean(props.validation.result?.valid);
    const validationStatusLabel=!sourceComplete?t('Source mapping is incomplete'):
        props.validation.status==='loading'?t('Checking source data'):
        props.validation.status==='error'?t('Validation could not finish'):
        props.validation.status==='complete'?t('Data issues need attention'):t('Validation has not run');
    const colorPickerValue=(value: string, fallback: string): string => /^#[0-9a-f]{6}$/i.test(value)?value:fallback;

    return (
        <div className='config-page'>
            <ConfigStepIntro
                eyebrow={t('Step {current} of {total}', { current: 4, total: 4 })}
                title={t('Review and finish')}
                description={t('Confirm the data mapping and interactions, then choose the display options users will see.')}
            />
            <ConfigSection title={t('Configuration summary')}>
                <div className='config-review-heading'>
                    <ConfigStatus
                        complete={validationPassed}
                        completeLabel={t('Ready to save')}
                        incompleteLabel={validationStatusLabel}
                    />
                </div>
                <dl className='config-review-grid'>
                    <div><dt>{t('Hierarchy format')}</dt><dd>{t(props.data.type===HierType.FLAT?'Separate level columns':'Parent and child rows')}</dd></div>
                    <div><dt>{t('Source worksheet')}</dt><dd>{props.data.worksheet.name||t('Not selected')}</dd></div>
                    <div><dt>{t('Hierarchy fields')}</dt><dd>{hierarchyFields||t('Not selected')}</dd></div>
                    <div><dt>{t('Selection behavior')}</dt><dd>{selectionBehaviorLabel}</dd></div>
                    <div><dt>{t('Dashboard filters')}</dt><dd>{filterSummary}</dd></div>
                    <div><dt>{t('Search')}</dt><dd>{props.data.options.searchEnabled?
                        `${ t('On') } · ${ t('auto-expand {state}', { state: t(props.data.options.searchAutoExpand===false?'off':'on') }) }`:
                        t('Off')}</dd></div>
                    <div><dt>{t('Parameter output')}</dt><dd>{t(parameterEnabled?'On':'Off')}</dd></div>
                    <div><dt>{t('Source mark selection')}</dt><dd>{t(props.data.worksheet.enableMarkSelection?'On':'Off')}</dd></div>
                </dl>
            </ConfigSection>
            <DataValidationPreview validation={props.validation} onRetry={props.onRetryValidation} />
            <HierarchyPreview data={props.data} validation={props.validation} />
            <ConfigSection
                title={t('Display')}
                description={t('These defaults work well in most dashboards and can be changed later.')}
            >
                <div className='config-display-options'>
                    <div className='config-option-row'>
                        <div><strong>{t('Search box')}</strong><p>{t('Let users quickly find items in larger hierarchies.')}</p></div>
                        <Checkbox checked={props.data.options.searchEnabled} onChange={changeSearch} aria-label={t('Show search box')} />
                    </div>
                    {props.data.options.searchEnabled&&
                        <div className='config-option-row config-option-row--nested'>
                            <div>
                                <strong>{t('Automatically expand matching paths')}</strong>
                                <p>{t('Turn this off when users should open matching ancestor branches themselves.')}</p>
                            </div>
                            <Checkbox
                                checked={props.data.options.searchAutoExpand!==false}
                                onChange={changeSearchAutoExpand}
                                aria-label={t('Automatically expand matching search paths')}
                            />
                        </div>
                    }
                    <div className='config-option-row config-option-row--stackable'>
                        <div><strong>{t('Extension title')}</strong><p>{t('Show a short heading above the navigator.')}</p></div>
                        <Checkbox checked={props.data.options.titleEnabled} onChange={changeTitleEnabled} aria-label={t('Show extension title')} />
                    </div>
                    {props.data.options.titleEnabled&&<div className='config-title-field'><TextField {...setTitleInputProps} /></div>}
                </div>
            </ConfigSection>
            <details className='config-advanced'>
                <summary>
                    <span><strong>{t('Advanced appearance')}</strong><small>{t('Colors, typography, row styles, and hierarchy icons.')}</small></span>
                </summary>
                <ConfigSection title={t('Colors and typography')}>
                    <div className='config-color-grid'>
                        <div className='config-color-field'><TextField {...setBGColorInputProps} /><input aria-label={t('Choose background color')} type='color' value={colorPickerValue(props.data.options.bgColor, '#f3f3f3')} onChange={bgChange} /></div>
                        <div className='config-color-field'><TextField {...setHighlightColorInputProps} /><input aria-label={t('Choose highlight color')} type='color' value={colorPickerValue(props.data.options.highlightColor, '#d1d1d1')} onChange={highlightColorChange} /></div>
                        <div className='config-color-field'><TextField {...setFontColorInputProps} /><input aria-label={t('Choose font color')} type='color' value={colorPickerValue(props.data.options.fontColor, '#222222')} onChange={fontColorChange} /></div>
                        <div><TextField {...setFontSizeInputProps} /></div>
                    </div>
                    <div className='config-area-field'><TextArea {...setFontFamilyInputProps} /></div>
                </ConfigSection>
                <ConfigSection title={t('Hierarchy icons')}>
                    <div className='config-field-grid config-field-grid--two'>
                        <div className='config-area-field'>
                            <DropdownSelect {...openedIconState} {...setOpenedIconInputPropsDropdown}>{items.map(makeOption)}</DropdownSelect>
                            <TextArea {...setOpenedIconInputProps} />
                        </div>
                        <div className='config-area-field'>
                            <DropdownSelect {...closedIconState} {...setClosedIconInputPropsDropdown}>{items.map(makeOption)}</DropdownSelect>
                            <TextArea {...setClosedIconInputProps} />
                        </div>
                    </div>
                    <div className='config-icon-preview' aria-label={t('Icon preview')}>
                        <strong>{t('Preview')}</strong>
                        <div>{openedIconPreview} Furniture</div>
                        <div className='config-icon-child'>Bookcases</div>
                        <div className='config-icon-child'>Chairs</div>
                        <div>{closedIconPreview} Office Supplies</div>
                        <div>{closedIconPreview} Technology</div>
                    </div>
                </ConfigSection>
            </details>
            <details className='config-advanced' open={props.data.options.dashboardListenersEnabled}>
                <summary>
                    <span><strong>{t('Advanced dashboard synchronization')}</strong><small>{t('Let dashboard parameters drive the navigator selection.')}</small></span>
                </summary>
                <ConfigSection
                    title={t('Listen for dashboard changes')}
                    description={t('Enable this only when the dashboard should update the navigator from {parameterType} parameters.', {
                        parameterType: t(props.data.type===HierType.RECURSIVE?'item ID or label':'the selected label')
                    })}
                    optional={true}
                >
                    <div className='config-option-row'>
                        <div><strong>{t('Enable parameter listeners')}</strong><p>{t('Leave off when the navigator is the only component controlling these parameters.')}</p></div>
                        <Checkbox checked={props.data.options.dashboardListenersEnabled} onChange={toggleDashboardListenersEnabled} aria-label={t('Enable dashboard parameter listeners')} />
                    </div>
                    {props.data.options.dashboardListenersEnabled&&
                        <div className='config-stepper-field'>
                            <label>{t('Update delay (milliseconds)')}</label>
                            <Stepper min={100} max={10000} step={50} pageSteps={5} value={props.data.options.debounce} floatingPoint={false} onValueChange={changeDebounce} />
                            <p>{t('Increase this if the extension and dashboard repeatedly update one another or the dashboard responds slowly.')}</p>
                        </div>
                    }
                </ConfigSection>
            </details>
            <details className='config-advanced' open={props.data.options.debug}>
                <summary>
                    <span><strong>{t('Developer settings')}</strong><small>{t('Custom item CSS and diagnostic logging.')}</small></span>
                </summary>
                <ConfigSection title={t('Developer settings')} optional={true}>
                    <div className='config-area-field'><TextArea {...setItemCSSInputProps} /></div>
                    <Checkbox checked={props.data.options.debug} onChange={toggleDebug}>{t('Enable debug logging')}</Checkbox>
                </ConfigSection>
            </details>
        </div>
    );
}
