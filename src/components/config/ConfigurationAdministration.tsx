import { ChangeEvent, useRef, useState } from 'react';
import { ConfigurationMigrationReport } from '../API/ConfigurationMigration';
import {
    getConfigurationExportFilename,
    parseHierarchyConfiguration,
    serializeHierarchyConfiguration
} from '../API/ConfigurationPackage';
import { HierarchyProps } from '../API/Interfaces';
import { useTranslation } from '../localization/I18n';
import { Button, TextArea } from '../shared/UiComponents';
import { ConfigSection } from './ConfigPrimitives';

interface Props {
    data: HierarchyProps;
    migrationReport: ConfigurationMigrationReport;
    onImport: (configuration: string) => void;
}

/** Import, export, and explain the portable configuration format. */
export function ConfigurationAdministration(props: Props) {
    const {t}=useTranslation();
    const [configuration, setConfiguration]=useState(() => serializeHierarchyConfiguration(props.data));
    const [message, setMessage]=useState('');
    const [valid, setValid]=useState<boolean|undefined>(undefined);
    const fileInputRef=useRef<HTMLInputElement|null>(null);

    const refreshExport=(): void => {
        setConfiguration(serializeHierarchyConfiguration(props.data));
        setMessage(t('JSON refreshed from the current configuration.'));
        setValid(true);
    };
    const applyImport=(): void => {
        try {
            parseHierarchyConfiguration(configuration);
            props.onImport(configuration);
            setMessage(t('Configuration imported. Review the mappings and validation before saving.'));
            setValid(true);
        }
        catch(error) {
            setMessage(t('Import failed: {message}', {
                message: error instanceof Error?error.message:String(error)
            }));
            setValid(false);
        }
    };
    const copyExport=async (): Promise<void> => {
        try {
            await window.navigator.clipboard.writeText(configuration);
            setMessage(t('Configuration JSON copied.'));
            setValid(true);
        }
        catch(error) {
            setMessage(t('Copy failed: {message}', {
                message: error instanceof Error?error.message:String(error)
            }));
            setValid(false);
        }
    };
    const downloadExport=(): void => {
        const url=URL.createObjectURL(new Blob([configuration], { type: 'application/json' }));
        const link=document.createElement('a');
        link.href=url;
        link.download=getConfigurationExportFilename(props.data);
        document.body.appendChild(link);
        try {
            link.click();
        }
        finally {
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 0);
        }
        setMessage(t('Configuration JSON downloaded.'));
        setValid(true);
    };
    const importFile=(event: ChangeEvent<HTMLInputElement>): void => {
        const file=event.target.files?.[0];
        event.target.value='';
        if(!file) { return; }
        file.text().then(text => {
            setConfiguration(text);
            setMessage(t('JSON file loaded. Choose Apply JSON to import it.'));
            setValid(undefined);
        }).catch(error => {
            setMessage(t('Import failed: {message}', {
                message: error instanceof Error?error.message:String(error)
            }));
            setValid(false);
        });
    };

    return (
        <ConfigSection
            title={t('Configuration administration')}
            description={t('Move settings between dashboards or keep a reviewable JSON backup. Live worksheet metadata is never exported.')}
        >
            <div className='config-migration-report'>
                <strong>{t('Configuration migration')}</strong>
                {props.migrationReport.migrated?
                    <>
                        <span>{props.migrationReport.fromVersion<props.migrationReport.toVersion?
                            t('Upgraded configuration format {from} → {to}.', {
                                from: props.migrationReport.fromVersion,
                                to: props.migrationReport.toVersion
                            }):
                            t('Configuration repairs were applied for format {version}.', {
                                version: props.migrationReport.toVersion
                            })
                        }</span>
                        <ul>{props.migrationReport.changes.map(change =>
                            <li key={change}>{t(change)}</li>
                        )}</ul>
                    </>:
                    <span>{t('This configuration already uses the current format ({version}).', {
                        version: props.migrationReport.toVersion
                    })}</span>
                }
            </div>
            <div className='config-area-field config-json-editor'>
                <TextArea
                    label={t('Portable configuration JSON')}
                    value={configuration}
                    rows={10}
                    valid={valid}
                    message={message||t('Import accepts exported packages and legacy raw settings objects.')}
                    spellCheck={false}
                    onChange={event => {
                        setConfiguration(event.target.value);
                        setMessage('');
                        setValid(undefined);
                    }}
                />
            </div>
            <div className='config-admin-actions'>
                <Button kind='outline' onClick={refreshExport}>{t('Refresh JSON')}</Button>
                <Button kind='outline' onClick={() => copyExport()}>{t('Copy JSON')}</Button>
                <Button kind='outline' onClick={downloadExport}>{t('Download JSON')}</Button>
                <Button kind='outline' onClick={() => fileInputRef.current?.click()}>{t('Load JSON file')}</Button>
                <Button kind='primary' onClick={applyImport}>{t('Apply JSON')}</Button>
                <input
                    ref={fileInputRef}
                    className='hierarchy-visually-hidden'
                    type='file'
                    accept='application/json,.json'
                    onChange={importFile}
                />
            </div>
        </ConfigSection>
    );
}
