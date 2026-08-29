import React from 'react';
import { HierarchyProps, Status } from '../API/Interfaces';
import { useTranslation } from '../localization/I18n';
import { Selector } from '../shared/Selector';
import { ConfigSection, ConfigStepIntro } from './ConfigPrimitives';
import { SelectionBehaviorControls } from './SelectionBehaviorControls';
import { TargetFilterControls } from './TargetFilterControls';
import { Checkbox } from '../shared/UiComponents';
import { NormalizedTreeNode } from '../extension/TreeModel';

interface Props {
    data: HierarchyProps;
    setUpdates: (obj: { type: string, data: any; }) => void;
    changeEnabled: (s: React.MouseEvent<HTMLInputElement, MouseEvent>|React.ChangeEvent<HTMLInputElement>) => void;
    changeParam: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    previewTree?: NormalizedTreeNode[];

}

export function Page3Recursive(props: Props) {
    const {t}=useTranslation();
    // PARAMETERS CONTENT
    return (
        <div className='config-page'>
            <ConfigStepIntro
                eyebrow={t('Step {current} of {total}', { current: 3, total: 4 })}
                title={t('Choose what a selection controls')}
                description={t('Filtering is the usual choice. Parameters and source mark selection are optional integrations for more advanced dashboards.')}
            />
            <SelectionBehaviorControls data={props.data} setUpdates={props.setUpdates} />
            <TargetFilterControls {...props} />
            <details className='config-advanced' open={props.data.parameters.childIdEnabled||props.data.parameters.childLabelEnabled}>
                <summary>
                    <span>
                        <strong>{t('Advanced: write values to parameters')}</strong>
                        <small>{t('Expose the selected item to calculations and parameter actions.')}</small>
                    </span>
                </summary>
                <ConfigSection
                    title={t('Parameter outputs')}
                    description={t('Create string parameters in Tableau first, then map them here. Leave these off if filtering is all you need.')}
                    optional={true}
                >
                    <div className='config-toggle-field'>
                    <Checkbox
                        disabled={!props.data.dashboardItems.parameters.length}
                        checked={props.data.parameters.childIdEnabled}
                        onChange={props.changeEnabled}
                        data-type='id'
                        aria-label={t('Write selected child ID to a parameter')}
                    >{t('Write selected item ID to a parameter')}</Checkbox>
                    {props.data.parameters.childIdEnabled&&
                        <Selector
                            title={t('Item ID parameter')}
                            status={props.data.dashboardItems.parameters.length? Status.set:Status.notpossible}
                            onChange={props.changeParam}
                            list={props.data.dashboardItems.parameters}
                            selected={props.data.parameters.childId}
                            type='id'
                        />
                    }
                    </div>
                    <div className='config-toggle-field'>
                    <Checkbox
                        disabled={!props.data.dashboardItems.parameters.length}
                        checked={props.data.parameters.childLabelEnabled}
                        onChange={props.changeEnabled}
                        data-type='label'
                        aria-label={t('Write selected child label to a parameter')}
                    >{t('Write selected item label to a parameter')}</Checkbox>
                    {props.data.parameters.childLabelEnabled&&
                        <Selector
                            title={t('Item label parameter')}
                            status={props.data.dashboardItems.parameters.length? Status.set:Status.notpossible}
                            onChange={props.changeParam}
                            list={props.data.dashboardItems.parameters}
                            selected={props.data.parameters.childLabel}
                            type='label'
                        />
                    }
                    </div>
                    {!props.data.dashboardItems.parameters.length&&
                        <p className='config-muted-note'>{t('No compatible string or integer parameters were found on this dashboard.')}</p>
                    }
                </ConfigSection>
            </details>
        </div>
    );
}
