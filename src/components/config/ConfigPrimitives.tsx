import React from 'react';
import { useTranslation } from '../localization/I18n';

interface ConfigStepIntroProps {
    eyebrow: string;
    title: string;
    description: string;
}

interface ConfigSectionProps {
    title: string;
    description?: string;
    optional?: boolean;
    children: React.ReactNode;
}

interface ConfigStatusProps {
    complete: boolean;
    completeLabel?: string;
    incompleteLabel?: string;
}

export function ConfigStepIntro(props: ConfigStepIntroProps) {
    return (
        <header className='config-step-intro'>
            <span className='config-eyebrow'>{props.eyebrow}</span>
            <h1>{props.title}</h1>
            <p>{props.description}</p>
        </header>
    );
}

export function ConfigSection(props: ConfigSectionProps) {
    const {t}=useTranslation();
    return (
        <section className='config-section'>
            <div className='config-section-heading'>
                <div>
                    <h2>{props.title}</h2>
                    {props.description&&<p>{props.description}</p>}
                </div>
                {props.optional&&<span className='config-tag'>{t('Optional')}</span>}
            </div>
            {props.children}
        </section>
    );
}

export function ConfigStatus(props: ConfigStatusProps) {
    const {t}=useTranslation();
    const label=props.complete?
        (props.completeLabel||t('Ready')):
        (props.incompleteLabel||t('Needs attention'));

    return (
        <span className={`config-status ${props.complete?'config-status--complete':'config-status--incomplete'}`}>
            <span aria-hidden='true'>{props.complete?'✓':'!'}</span>
            {label}
        </span>
    );
}
