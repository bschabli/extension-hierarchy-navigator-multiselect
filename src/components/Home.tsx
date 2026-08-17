import * as React from 'react';
import { createRoot } from 'react-dom/client';
import '../css/style.css';
import hierimage from '../images/TableauHierarchyNavigator.png';
 
class AHome extends React.Component<any, any> {
	public render() {	
        return (
			<React.Fragment>
				<div className='icontainer'>
					<div className='box'>
						<div className='left'>
							<div><img src={hierimage} width='45%' alt='Hierarchy Navigator tree' /></div>
							<h1 className='iheader'>Hierarchy Navigator Multiselect</h1>
							<span className='tagline'>Flat and recursive Tableau hierarchies with checkbox selection</span>
						</div>
						<div className='right'>
							<h4 className='big'>About this project</h4>
							<p>
								This fork extends the open-source Tableau Hierarchy Navigator with shared checkbox
								multi-selection for Flat/Dimensional and Recursive hierarchies.
							</p>
							<ul>
								<li>Select leaves across multiple branches.</li>
								<li>Select or clear an entire parent subtree.</li>
								<li>See checked and indeterminate parent states.</li>
								<li>Handle incomplete Flat paths without visible NULL nodes.</li>
								<li>Apply the complete selection to filters on multiple Tableau worksheets.</li>
								<li>Validate IDs, labels, parent relationships, cycles, and hierarchy paths before saving.</li>
								<li>Try the configured hierarchy in a live, dashboard-safe preview before saving.</li>
							</ul>
							<h4 className='big'>Test the Extension</h4>
							<ol>
								<li><a href='./hierarchynavigator-multiselect.trex'>Download the multiselect test manifest</a>.</li>
								<li>In Tableau, add an Extension and choose <b>My Extensions</b>, then select the downloaded manifest.</li>
								<li>Configure the hierarchy source worksheet, ordered fields or recursive IDs, and one or more target worksheet/filter mappings.</li>
								<li>Use the included <a href='./Hierarchy%20Navigator%20Extension%20v2.twbx'>sample workbook</a> as a starting point if needed.</li>
							</ol>
							<p><b>Testing note:</b> This is a proof-of-concept build hosted from the multiselect feature branch.</p>
							<div className='gh' style={{paddingTop: '10px'}}>
								<a href='https://github.com/bschabli/extension-hierarchy-navigator-multiselect'>View source and documentation on GitHub</a>
							</div>
						</div>
					</div>
				</div>
			</React.Fragment>
        );
    }
}

export default AHome;
const container = document.getElementById('app') as HTMLElement;
const root = createRoot(container);

root.render(<AHome tab="home" />);
