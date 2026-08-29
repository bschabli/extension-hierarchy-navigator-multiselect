import { useTranslation } from '../localization/I18n';
import { HierarchyRuntimeDiagnostics } from './DiagnosticsModel';

interface Props {
    diagnostics: HierarchyRuntimeDiagnostics;
}

/** Display current hierarchy performance, outputs, and Tableau API capabilities. */
export function DiagnosticsPanel(props: Props) {
    const {t}=useTranslation();
    const capabilities=[
        ['Paged summary data', props.diagnostics.capabilities.pagedSummaryData],
        ['Summary column metadata', props.diagnostics.capabilities.summaryColumnMetadata],
        ['Source data change events', props.diagnostics.capabilities.sourceDataEvents],
        ['Categorical worksheet filtering', props.diagnostics.capabilities.categoricalFiltering],
        ['Source mark selection API', props.diagnostics.capabilities.sourceMarkSelection],
        ['Settings persistence API', props.diagnostics.capabilities.settingsPersistence]
    ] as const;
    return (
        <details className='hierarchy-diagnostics'>
            <summary>{t('Diagnostics')}</summary>
            <dl className='hierarchy-diagnostics-grid'>
                <div><dt>{t('Source rows')}</dt><dd>{props.diagnostics.rowCount}</dd></div>
                <div><dt>{t('Hierarchy nodes')}</dt><dd>{props.diagnostics.nodeCount}</dd></div>
                <div><dt>{t('Load time')}</dt><dd>{t('{count} ms', { count: props.diagnostics.loadTimeMs })}</dd></div>
                <div><dt>{t('Refresh mode')}</dt><dd>{t(props.diagnostics.refreshMode)}</dd></div>
                <div><dt>{t('Nodes reused')}</dt><dd>{props.diagnostics.reusedNodeCount}</dd></div>
                <div><dt>{t('Filters applied')}</dt><dd>{props.diagnostics.filtersApplied}</dd></div>
                <div><dt>{t('Virtualized rendering')}</dt><dd>{t(props.diagnostics.virtualizationEnabled?'On':'Off')}</dd></div>
            </dl>
            <strong>{t('Detected Tableau API capabilities')}</strong>
            <ul className='hierarchy-capability-list'>
                {capabilities.map(([label, supported]) =>
                    <li key={label} className={supported?'hierarchy-capability--supported':'hierarchy-capability--missing'}>
                        <span aria-hidden='true'>{supported?'✓':'–'}</span>
                        {t(label)}
                    </li>
                )}
            </ul>
        </details>
    );
}
