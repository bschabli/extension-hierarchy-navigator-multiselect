import { createRoot } from 'react-dom/client';
import '../css/style.css';
import '../css/viz.css';
import { LocalizationProvider, useTranslation } from './localization/I18n';

function Home() {
    const {t}=useTranslation();
    return <main className='hierarchy-viz viz-home'>
        <span className='viz-eyebrow'>TABLEAU VIZ EXTENSION</span>
        <h1>Hierarchy Navigator</h1>
        <p className='viz-lead'>{t('Navigate your hierarchies and filter your dashboard with multi-selection, directly from a Tableau worksheet.')}</p>
        <a className='viz-download' href='./hierarchy-viz.trex'>{t('Download Viz Extension')}</a>
        <div className='viz-home-grid'>
            <article><h2>Hierarchy Navigator</h2><p>{t('Browse flat and recursive hierarchies with multi-selection, search, breadcrumbs and keyboard navigation.')}</p></article>
            <article><h2>{t('Native Tableau workflow')}</h2><p>{t('Assign fields on the Marks card. Use Tableau selection actions to filter other worksheets or update parameters.')}</p></article>
        </div>
        <h2>{t('Set up your hierarchy')}</h2>
        <ol><li>{t('In Tableau 2024.2 or later, choose Add Extension on the worksheet Marks card and open the manifest.')}</li>
            <li>{t('Hierarchy: ordered levels, or one label for a recursive hierarchy.')}</li>
            <li>{t('Node ID: a unique key for each row.')}</li>
            <li>{t('Parent ID: optional, enables a recursive hierarchy.')}</li>
        </ol>
        <p><a href='https://github.com/bschabli/extension-hierarchy-navigator-multiselect'>{t('Documentation and source code')}</a></p>
        <p>{t('Existing dashboard workbooks can continue using the compatibility extension.')} <a href='./hierarchynavigator-multiselect.trex'>{t('Dashboard compatibility manifest')}</a></p>
    </main>;
}

const container=document.getElementById('app');
if(container) { createRoot(container).render(<LocalizationProvider><Home/></LocalizationProvider>); }
export default Home;
