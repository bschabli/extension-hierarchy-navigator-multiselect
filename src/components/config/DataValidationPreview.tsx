import { Button } from '@tableau/tableau-ui';
import { HierarchyValidationCheck } from '../API/HierarchyValidation';
import { useTranslation } from '../localization/I18n';
import { ConfigSection } from './ConfigPrimitives';
import { HierarchyValidationState } from './useHierarchyValidation';

interface Props {
    onRetry: () => void;
    validation: HierarchyValidationState;
}

/** Show source-data checks that must pass before configuration can be saved. */
export function DataValidationPreview(props: Props) {
    const {locale, t}=useTranslation();
    const { validation }=props;
    const failedChecks=validation.result?.checks.filter(check => check.status==='failed')||[];
    const issueCount=failedChecks.reduce((count, check) => count+check.issueCount, 0);

    return (
        <ConfigSection
            title={t('Data validation preview')}
            description={t('Check the current source worksheet for structural problems before saving. Trailing blank levels in variable-depth hierarchies are allowed.')}
        >
            <div className='config-validation' aria-live='polite'>
                {validation.status==='idle'&&
                    <div className='config-validation-message config-validation-message--neutral'>
                        {t('Complete the source worksheet and field mapping to run validation.')}
                    </div>
                }
                {validation.status==='loading'&&
                    <div className='config-validation-message config-validation-message--loading' aria-busy='true'>
                        <span className='config-validation-spinner' aria-hidden='true' />
                        {t('Reading and validating the source worksheet…')}
                    </div>
                }
                {validation.status==='error'&&
                    <div className='config-validation-message config-validation-message--error' role='alert'>
                        <div>
                            <strong>{t('Validation could not finish')}</strong>
                            <p>{validation.errorMessage}</p>
                        </div>
                        <Button kind='outline' onClick={props.onRetry}>{t('Retry validation')}</Button>
                    </div>
                }
                {validation.status==='complete'&&validation.result&&
                    <>
                        <div className={`config-validation-summary ${validation.result.valid?'config-validation-summary--passed':'config-validation-summary--failed'}`}>
                            <div>
                                <strong>{validation.result.valid?t('Validation passed'):
                                    t(issueCount===1?'{count} data issue found':'{count} data issues found', { count: issueCount })}</strong>
                                <p>{t(validation.result.rowsChecked===1?'{count} source row checked.':'{count} source rows checked.', {
                                    count: validation.result.rowsChecked.toLocaleString(locale)
                                })}</p>
                            </div>
                            <Button kind='outline' onClick={props.onRetry}>{t('Run again')}</Button>
                        </div>
                        <ul className='config-validation-checks'>
                            {validation.result.checks.map(check => (
                                <li className={`config-validation-check config-validation-check--${check.status}`} key={check.code}>
                                    <span className='config-validation-icon' aria-hidden='true'>
                                        {check.status==='passed'?'✓':check.status==='failed'?'!':'—'}
                                    </span>
                                    <div>
                                        <strong>{getLocalizedCheckTitle(check, t)}</strong>
                                        <p>{getLocalizedCheckDescription(check, t)}</p>
                                        {check.examples.length>0&&
                                            <ul className='config-validation-examples'>
                                                {check.examples.map(example => <li key={example}>{getLocalizedExample(example, t)}</li>)}
                                            </ul>
                                        }
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </>
                }
            </div>
        </ConfigSection>
    );
}

function getLocalizedCheckTitle(
    check: HierarchyValidationCheck,
    t: ReturnType<typeof useTranslation>['t']
): string {
    if(check.description==='No source rows were returned for validation.') {
        return t('No source rows were returned for validation.');
    }
    const titles={
        'duplicate-ids': 'IDs are unique',
        'orphaned-children': 'Children have known parents',
        'circular-relationships': 'Relationships contain no cycles',
        'blank-labels': 'Labels are populated',
        'malformed-paths': 'Paths are well-formed'
    };
    return t(titles[check.code]);
}

function getLocalizedCheckDescription(
    check: HierarchyValidationCheck,
    t: ReturnType<typeof useTranslation>['t']
): string {
    if(check.status==='not-applicable') {
        return t('This check does not apply to the selected hierarchy format.');
    }
    if(check.status==='passed') {
        const passed={
            'duplicate-ids': 'Every populated ID appears once.',
            'orphaned-children': 'Every populated parent ID exists in the source data.',
            'circular-relationships': 'No item eventually points back to itself.',
            'blank-labels': 'Every required hierarchy label is populated.',
            'malformed-paths': 'Every row can be converted into an unambiguous hierarchy path.'
        };
        return t(passed[check.code]);
    }
    const failed={
        'duplicate-ids': check.issueCount===1?'{count} ID appears more than once.':'{count} IDs appear more than once.',
        'orphaned-children': check.issueCount===1?'{count} child references a parent that is not present.':'{count} children reference a parent that is not present.',
        'circular-relationships': check.issueCount===1?'{count} circular relationship was found.':'{count} circular relationships were found.',
        'blank-labels': check.issueCount===1?'{count} row has a required blank label.':'{count} rows have a required blank label.',
        'malformed-paths': check.issueCount===1?'{count} malformed hierarchy path was found.':'{count} malformed hierarchy paths were found.'
    };
    return t(failed[check.code], { count: check.issueCount });
}

function getLocalizedExample(
    example: string,
    t: ReturnType<typeof useTranslation>['t']
): string {
    const patterns: Array<[RegExp, string, string[]]>=[
        [/^Row (\d+): the ID is blank\.$/, 'Row {row}: the ID is blank.', ['row']],
        [/^Row (\d+): every hierarchy label is blank\.$/, 'Row {row}: every hierarchy label is blank.', ['row']],
        [/^Row (\d+): the hierarchy path is empty\.$/, 'Row {row}: the hierarchy path is empty.', ['row']],
        [/^Row (\d+): (.+) is blank before a deeper level\.$/, 'Row {row}: {field} is blank before a deeper level.', ['row', 'field']],
        [/^Row (\d+): a deeper value follows the blank (.+) field\.$/, 'Row {row}: a deeper value follows the blank {field} field.', ['row', 'field']],
        [/^Row (\d+): a label contains the configured “(.+)” separator\.$/, 'Row {row}: a label contains the configured “{separator}” separator.', ['row', 'separator']],
        [/^ID “(.+)” appears (\d+) times\.$/, 'ID “{id}” appears {count} times.', ['id', 'count']],
        [/^Child “(.+)” references missing parent “(.+)”\.$/, 'Child “{id}” references missing parent “{parent}”.', ['id', 'parent']],
        [/^Row (\d+): the child ID is blank\.$/, 'Row {row}: the child ID is blank.', ['row']],
        [/^Row (\d+) \(ID “(.+)”\): the display label is blank\.$/, 'Row {row} (ID “{id}”): the display label is blank.', ['row', 'id']],
        [/^Row (\d+): the display label is blank\.$/, 'Row {row}: the display label is blank.', ['row']]
    ];
    for(const [pattern, message, names] of patterns) {
        const match=example.match(pattern);
        if(match) {
            const values=names.reduce<Record<string, string>>((result, name, index) => {
                result[name]=match[index+1];
                return result;
            }, {});
            return t(message, values);
        }
    }
    return t(example);
}
