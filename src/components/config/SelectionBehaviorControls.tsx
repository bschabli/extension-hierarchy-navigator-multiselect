import { HierarchyProps, HierType } from '../API/Interfaces';
import { SelectionBehavior } from '../API/SelectionBehavior';
import { useTranslation } from '../localization/I18n';
import { ConfigSection } from './ConfigPrimitives';

interface Props {
    data: HierarchyProps;
    setUpdates: (update: { type: string, data: any }) => void;
}

interface BehaviorChoice {
    description: string;
    example: string;
    recommended?: boolean;
    title: string;
    value: SelectionBehavior;
}

const CHOICES: BehaviorChoice[]=[
    {
        description: 'A parent selects only the visual leaves below it. Intermediate node IDs are not included.',
        example: 'Furniture → Atlantic, Bush, Hon',
        recommended: true,
        title: 'Terminal values only',
        value: SelectionBehavior.TERMINAL
    },
    {
        description: 'A parent selects its own direct ID plus every directly represented node below it.',
        example: 'Furniture → Furniture, Bookcases, Atlantic, Bush, Chairs, Hon',
        title: 'Entire subtree',
        value: SelectionBehavior.SUBTREE
    },
    {
        description: 'Each checkbox controls only the ID attached directly to that node. Children stay independent.',
        example: 'Furniture → Furniture',
        title: 'This node only',
        value: SelectionBehavior.NODE
    }
];

/** Configure how a node checkbox maps to Tableau filter values. */
export function SelectionBehaviorControls(props: Props) {
    const {t}=useTranslation();
    const selected=props.data.options.selectionBehavior||SelectionBehavior.TERMINAL;
    const directValueExplanation=props.data.type===HierType.FLAT?
        t('For separate level columns, a node has a direct value only when a source row ends at that level; the mapped Unique path ID supplies its filter value.'):
        t('For parent/child data, every valid source row represents one node and its Child ID supplies the direct filter value.');

    return (
        <ConfigSection
            title={t('Selection behavior')}
            description={t('Choose which IDs a checkbox sends to every configured target filter field.')}
        >
            <div className='config-behavior-grid' role='radiogroup' aria-label={t('Selection behavior')}>
                {CHOICES.map(choice => (
                    <button
                        className={`config-behavior-choice ${selected===choice.value?'config-behavior-choice--selected':''}`}
                        key={choice.value}
                        type='button'
                        role='radio'
                        aria-checked={selected===choice.value}
                        onClick={() => props.setUpdates({ type: 'SET_SELECTION_BEHAVIOR', data: choice.value })}
                    >
                        <span className='config-behavior-heading'>
                            <span className='config-radio' aria-hidden='true' />
                            <strong>{t(choice.title)}</strong>
                            {choice.recommended&&<span className='config-tag config-tag--recommended'>{t('Recommended')}</span>}
                        </span>
                        <span className='config-behavior-description'>{t(choice.description)}</span>
                        <span className='config-behavior-example'>{t(choice.example)}</span>
                    </button>
                ))}
            </div>
            <p className='config-muted-note config-behavior-note'>
                <strong>{t('What “direct ID” means:')}</strong> {directValueExplanation}
            </p>
        </ConfigSection>
    );
}
