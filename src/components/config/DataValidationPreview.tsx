import { Button } from '@tableau/tableau-ui';
import { ConfigSection } from './ConfigPrimitives';
import { HierarchyValidationState } from './useHierarchyValidation';

interface Props {
    onRetry: () => void;
    validation: HierarchyValidationState;
}

/** Show source-data checks that must pass before configuration can be saved. */
export function DataValidationPreview(props: Props) {
    const { validation }=props;
    const failedChecks=validation.result?.checks.filter(check => check.status==='failed')||[];
    const issueCount=failedChecks.reduce((count, check) => count+check.issueCount, 0);

    return (
        <ConfigSection
            title='Data validation preview'
            description='Check the current source worksheet for structural problems before saving. Trailing blank levels in variable-depth hierarchies are allowed.'
        >
            <div className='config-validation' aria-live='polite'>
                {validation.status==='idle'&&
                    <div className='config-validation-message config-validation-message--neutral'>
                        Complete the source worksheet and field mapping to run validation.
                    </div>
                }
                {validation.status==='loading'&&
                    <div className='config-validation-message config-validation-message--loading' aria-busy='true'>
                        <span className='config-validation-spinner' aria-hidden='true' />
                        Reading and validating the source worksheet…
                    </div>
                }
                {validation.status==='error'&&
                    <div className='config-validation-message config-validation-message--error' role='alert'>
                        <div>
                            <strong>Validation could not finish</strong>
                            <p>{validation.errorMessage}</p>
                        </div>
                        <Button kind='outline' onClick={props.onRetry}>Retry validation</Button>
                    </div>
                }
                {validation.status==='complete'&&validation.result&&
                    <>
                        <div className={`config-validation-summary ${validation.result.valid?'config-validation-summary--passed':'config-validation-summary--failed'}`}>
                            <div>
                                <strong>{validation.result.valid?'Validation passed':`${ issueCount } data issue${ issueCount===1?'':'s' } found`}</strong>
                                <p>{validation.result.rowsChecked.toLocaleString()} source row{validation.result.rowsChecked===1?'':'s'} checked.</p>
                            </div>
                            <Button kind='outline' onClick={props.onRetry}>Run again</Button>
                        </div>
                        <ul className='config-validation-checks'>
                            {validation.result.checks.map(check => (
                                <li className={`config-validation-check config-validation-check--${check.status}`} key={check.code}>
                                    <span className='config-validation-icon' aria-hidden='true'>
                                        {check.status==='passed'?'✓':check.status==='failed'?'!':'—'}
                                    </span>
                                    <div>
                                        <strong>{check.title}</strong>
                                        <p>{check.description}</p>
                                        {check.examples.length>0&&
                                            <ul className='config-validation-examples'>
                                                {check.examples.map(example => <li key={example}>{example}</li>)}
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
