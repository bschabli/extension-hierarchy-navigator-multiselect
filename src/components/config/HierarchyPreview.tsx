import React, { useEffect, useMemo, useRef, useState } from 'react';
import { HierarchyProps, Options } from '../API/Interfaces';
import { SelectionBehavior, getSelectionBehaviorLabel } from '../API/SelectionBehavior';
import { useTranslation } from '../localization/I18n';
import { HighlightedHierarchyLabel } from '../shared/HighlightedHierarchyLabel';
import {
    CheckboxState,
    NormalizedTreeNode,
    getAllSelectableFilterValues,
    getNodeSelectionValues,
    getSelectionState,
    toggleNodeSelection
} from '../extension/TreeModel';
import { ConfigSection } from './ConfigPrimitives';
import { getHierarchyPreviewRows } from './HierarchyPreviewModel';
import { HierarchyValidationState } from './useHierarchyValidation';

interface Props {
    data: HierarchyProps;
    validation: HierarchyValidationState;
}

interface PreviewCheckboxProps {
    disabled: boolean;
    label: string;
    onChange: () => void;
    state: CheckboxState;
}

const EMPTY_TREE: NormalizedTreeNode[]=[];
const MAX_VISIBLE_ROWS=100;

function PreviewCheckbox(props: PreviewCheckboxProps) {
    const {t}=useTranslation();
    const checkboxRef=useRef<HTMLInputElement>(null);
    useEffect(() => {
        if(checkboxRef.current) { checkboxRef.current.indeterminate=props.state==='some'; }
    }, [props.state]);

    return (
        <input
            ref={checkboxRef}
            type='checkbox'
            checked={props.state==='all'}
            disabled={props.disabled}
            aria-label={t('Select {label} in preview', { label: props.label })}
            onChange={props.onChange}
        />
    );
}

function PreviewIcon(props: { expanded: boolean, options: Options }) {
    const type=props.expanded?props.options.openedIconType:props.options.closedIconType;
    if(type==='Base64 Image') {
        const image=props.expanded?props.options.openedIconBase64Image:props.options.closedIconBase64Image;
        if(image) { return <img src={image} width='12' height='12' alt='' />; }
    }
    if(type==='Ascii') {
        return <span aria-hidden='true'>{props.expanded?props.options.openedIconAscii:props.options.closedIconAscii}</span>;
    }
    return (
        <svg aria-hidden='true' width='12' height='12' viewBox='0 0 16 16'>
            <path
                d={props.expanded?'M3.5 5.5 8 10l4.5-4.5':'M5.5 3.5 10 8l-4.5 4.5'}
                fill='none'
                stroke='currentColor'
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='1.5'
            />
        </svg>
    );
}

function getInitialExpandedKeys(tree: readonly NormalizedTreeNode[]): Set<string> {
    const expanded=new Set<string>();
    if(tree.length>0&&tree[0].nodes.length>0) {
        expanded.add(tree[0].key);
        if(tree[0].nodes[0].nodes.length>0) { expanded.add(tree[0].nodes[0].key); }
    }
    return expanded;
}

/** Show a safe, interactive rendering of the configured hierarchy. */
export function HierarchyPreview(props: Props) {
    const {locale, t}=useTranslation();
    const tree=props.validation.previewTree||EMPTY_TREE;
    const selectionBehavior=props.data.options.selectionBehavior||SelectionBehavior.TERMINAL;
    const autoExpandSearch=props.data.options.searchAutoExpand!==false;
    const [expandedKeys, setExpandedKeys]=useState<Set<string>>(new Set<string>());
    const [searchTerm, setSearchTerm]=useState('');
    const [selectedLeafValues, setSelectedLeafValues]=useState<Set<string>>(new Set<string>());

    useEffect(() => {
        setExpandedKeys(getInitialExpandedKeys(tree));
        setSearchTerm('');
        setSelectedLeafValues(new Set<string>());
    }, [selectionBehavior, tree]);

    useEffect(() => {
        if(!props.data.options.searchEnabled) { setSearchTerm(''); }
    }, [props.data.options.searchEnabled]);

    const allSelectableFilterValues=useMemo(
        () => getAllSelectableFilterValues(tree, selectionBehavior),
        [selectionBehavior, tree]
    );
    const visibleRows=useMemo(
        () => getHierarchyPreviewRows(tree, expandedKeys, searchTerm, MAX_VISIBLE_ROWS, autoExpandSearch),
        [autoExpandSearch, expandedKeys, searchTerm, tree]
    );
    const searchActive=searchTerm.trim()!=='';
    const allSelected=allSelectableFilterValues.length>0&&
        allSelectableFilterValues.length===selectedLeafValues.size&&
        allSelectableFilterValues.every(value => selectedLeafValues.has(value));
    const previewReady=props.validation.status==='complete'&&
        Boolean(props.validation.result?.valid)&&tree.length>0;
    const fontFamily=props.data.options.fontFamily.replace(/\s*!important\s*$/i, '');
    const itemStyle=props.data.options.itemCSS;
    const previewStyle={
        '--preview-highlight': props.data.options.highlightColor,
        backgroundColor: props.data.options.bgColor,
        color: props.data.options.fontColor,
        fontFamily,
        fontSize: props.data.options.fontSize
    } as React.CSSProperties;

    function toggleExpanded(node: NormalizedTreeNode): void {
        setExpandedKeys(current => {
            const next=new Set(current);
            if(next.has(node.key)) { next.delete(node.key); }
            else { next.add(node.key); }
            return next;
        });
    }

    function toggleSelection(node: NormalizedTreeNode): void {
        setSelectedLeafValues(current => toggleNodeSelection(node, current, selectionBehavior));
    }

    return (
        <ConfigSection
            title={t('Live hierarchy preview')}
            description={t('Try search, expand branches, and select items before saving. Preview interactions never change the dashboard.')}
        >
            {!previewReady&&
                <div className='config-preview-placeholder' aria-live='polite'>
                    {props.validation.status==='loading'?t('Building the preview from the source worksheet…'):
                        props.validation.status==='complete'&&!props.validation.result?.valid?
                            t('Fix the validation issues above to unlock the live preview.'):
                            props.validation.status==='error'?
                                t('The preview is unavailable because the source data could not be read.'):
                                t('Complete the source mapping to build the live preview.')}
                </div>
            }
            {previewReady&&
                <div className='config-hierarchy-preview' style={previewStyle}>
                    <div className='config-preview-toolbar'>
                        <div>
                            {props.data.options.titleEnabled&&
                                <strong className='config-preview-title'>{props.data.options.title||'Hierarchy Navigator'}</strong>
                            }
                            <span className='config-preview-selection-status' role='status' aria-live='polite'>
                                {selectedLeafValues.size===0?
                                    t('All values shown (no filter)'):
                                    t(selectedLeafValues.size===1?'{count} preview value selected':'{count} preview values selected', {
                                        count: selectedLeafValues.size
                                    })}
                            </span>
                        </div>
                        <div className='config-preview-actions'>
                            <button
                                type='button'
                                disabled={allSelected||allSelectableFilterValues.length===0}
                                onClick={() => setSelectedLeafValues(new Set(allSelectableFilterValues))}
                            >{t('Select all')}</button>
                            <button
                                type='button'
                                disabled={selectedLeafValues.size===0}
                                onClick={() => setSelectedLeafValues(new Set<string>())}
                            >{t('Reset preview')}</button>
                        </div>
                    </div>
                    {props.data.options.searchEnabled&&
                        <label className='config-preview-search'>
                            <span className='config-preview-search-icon' aria-hidden='true'>⌕</span>
                            <span className='config-visually-hidden'>{t('Search preview hierarchy')}</span>
                            <input
                                type='search'
                                placeholder={t('Type and search')}
                                value={searchTerm}
                                onChange={event => setSearchTerm(event.target.value)}
                            />
                            {searchActive&&
                                <span className='config-preview-search-count' role='status'>
                                    {t(visibleRows.matchCount===1?'{count} match':'{count} matches', {
                                        count: visibleRows.matchCount
                                    })}
                                </span>
                            }
                        </label>
                    }
                    <div className='config-preview-tree-scroll'>
                        {visibleRows.rows.length===0&&
                            <div className='config-preview-empty'>{t('No hierarchy items match “{term}”.', { term: searchTerm })}</div>
                        }
                        <ul className='config-preview-tree' role='tree' aria-label={t('Hierarchy preview')}>
                            {visibleRows.rows.map(row => {
                                const hasChildren=row.node.nodes.length>0;
                                const checkboxState=getSelectionState(row.node, selectedLeafValues, selectionBehavior);
                                const selectable=getNodeSelectionValues(row.node, selectionBehavior).length>0;
                                return (
                                    <li
                                        className='config-preview-row'
                                        key={row.node.key}
                                        role='treeitem'
                                        aria-expanded={hasChildren?row.expanded:undefined}
                                        aria-level={row.depth+1}
                                        style={{ paddingLeft: `${ 8+row.depth*18 }px` }}
                                    >
                                        <button
                                            className={`config-preview-toggle${hasChildren?'':' config-preview-toggle--empty'}`}
                                            type='button'
                                            disabled={!hasChildren||(searchActive&&autoExpandSearch)}
                                            aria-label={hasChildren?
                                                t(row.expanded?'Collapse {label}':'Expand {label}', { label: row.node.label }):
                                                undefined}
                                            onClick={() => toggleExpanded(row.node)}
                                        >
                                            {hasChildren&&<PreviewIcon expanded={row.expanded} options={props.data.options} />}
                                        </button>
                                        <PreviewCheckbox
                                            label={row.node.label}
                                            state={checkboxState}
                                            disabled={!selectable}
                                            onChange={() => toggleSelection(row.node)}
                                        />
                                        <button
                                            className='config-preview-label'
                                            type='button'
                                            disabled={!selectable}
                                            style={itemStyle}
                                            onClick={() => toggleSelection(row.node)}
                                        ><HighlightedHierarchyLabel label={row.node.label} searchTerm={searchTerm} /></button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                    <div className='config-preview-footer'>
                        <span>{t(getSelectionBehaviorLabel(selectionBehavior))} · {t(
                            allSelectableFilterValues.length===1?'{count} selectable value':'{count} selectable values',
                            { count: allSelectableFilterValues.length.toLocaleString(locale) }
                        )}</span>
                        <span>{t('Preview only')}</span>
                        {visibleRows.truncated&&<span>{t('Showing the first {count} visible items', { count: MAX_VISIBLE_ROWS })}</span>}
                    </div>
                </div>
            }
        </ConfigSection>
    );
}
