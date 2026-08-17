import * as React from 'react';
import { createRoot } from 'react-dom/client';
import '../css/style.css';
import hierimage from '../images/TableauHierarchyNavigator.png';
import { LocalizationProvider, useTranslation } from './localization/I18n';

function AHome() {
    const {t}=useTranslation();
    return (
			<React.Fragment>
				<div className='icontainer'>
					<div className='box'>
						<div className='left'>
							<div><img src={hierimage} width='45%' alt={t('Hierarchy preview')} /></div>
							<h1 className='iheader'>{t('Hierarchy Navigator Multiselect')}</h1>
							<span className='tagline'>{t('Flat and recursive Tableau hierarchies with checkbox selection')}</span>
						</div>
						<div className='right'>
							<h4 className='big'>{t('About this project')}</h4>
							<p>
								{t('This fork extends the open-source Tableau Hierarchy Navigator with shared checkbox multi-selection for Flat/Dimensional and Recursive hierarchies.')}
							</p>
							<ul>
								<li>{t('Select leaves across multiple branches.')}</li>
								<li>{t('Select or clear an entire parent subtree.')}</li>
								<li>{t('See checked and indeterminate parent states.')}</li>
								<li>{t('Handle incomplete Flat paths without visible NULL nodes.')}</li>
								<li>{t('Apply the complete selection to filters on multiple Tableau worksheets.')}</li>
								<li>{t('Validate IDs, labels, parent relationships, cycles, and hierarchy paths before saving.')}</li>
								<li>{t('Try the configured hierarchy in a live, dashboard-safe preview before saving.')}</li>
								<li>{t('Choose whether a parent selects terminal values, its entire subtree, or only its own direct ID.')}</li>
								<li>{t('Search with highlighted matches, retained ancestor context, and optional automatic path expansion.')}</li>
								<li>{t('Keep expanded branches, search text, and valid selections through dashboard data refreshes.')}</li>
								<li>{t('Navigate the hierarchy fully by keyboard with visible focus and screen-reader announcements.')}</li>
								<li>{t('Use the complete interface in English or German based on the Tableau or browser locale.')}</li>
							</ul>
							<h4 className='big'>{t('Test the Extension')}</h4>
							<ol>
								<li><a href='./hierarchynavigator-multiselect.trex'>{t('Download the multiselect test manifest')}</a>.</li>
								<li>{t('In Tableau, add an Extension and choose My Extensions, then select the downloaded manifest.')}</li>
								<li>{t('Configure the hierarchy source worksheet, ordered fields or recursive IDs, and one or more target worksheet/filter mappings.')}</li>
								<li>{t('Use the included')} <a href='./Hierarchy%20Navigator%20Extension%20v2.twbx'>{t('sample workbook')}</a> {t('as a starting point if needed.')}</li>
							</ol>
							<p><b>{t('Testing note:')}</b> {t('This is a proof-of-concept build hosted from the multiselect feature branch.')}</p>
							<div className='gh' style={{paddingTop: '10px'}}>
								<a href='https://github.com/bschabli/extension-hierarchy-navigator-multiselect'>{t('View source and documentation on GitHub')}</a>
							</div>
						</div>
					</div>
				</div>
			</React.Fragment>
    );
}

export default AHome;
const container = document.getElementById('app') as HTMLElement;
const root = createRoot(container);

root.render(<LocalizationProvider><AHome /></LocalizationProvider>);
