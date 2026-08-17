import { Button } from '@tableau/tableau-ui';
import * as React from 'react';
import { useTranslation } from '../localization/I18n';

interface SelectedProps {
    onClear?: () => void;
    selected: string;
}

// An individual setting that has been set
export const Selected: React.SFC<SelectedProps> = (props) => {
    const {t}=useTranslation();

    return (
        <div className='d-flex flex-row'>
            <div className='p-2 w-100'>
                <i>{t('{label} has been selected', { label: props.selected })}</i>
            </div>
            <div className='p-2 flex-shrink-1'>
                <Button onClick={props.onClear} style={{ marginLeft: '12px' }}>{t('Clear')}</Button>
            </div>
        </div>
    );
};
