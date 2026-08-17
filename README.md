# Hierarchy Navigator Multiselect

Hierarchy Navigator Multiselect is a Tableau dashboard extension for navigating flat/dimensional and recursive hierarchies with shared checkbox selection.

## Features

- Flat hierarchies stored as ordered level columns
- Recursive parent/child hierarchies
- Multi-selection with selected, unselected, and partially selected parent states
- Configurable parent selection behavior: terminal values, entire subtree, or direct node only
- Filtering across multiple target worksheets with an independent field mapping for each worksheet
- Optional parameter output and source-sheet mark selection
- Data validation for duplicate IDs, orphaned children, cycles, blank labels, and malformed paths
- Live hierarchy preview during configuration
- Search highlighting, ancestor context, and automatic path expansion
- Remembered expansion, search, and selection state across data refreshes
- Keyboard navigation, screen-reader announcements, and English/German localization

## Test the hosted extension

1. Open the [project test page](https://bschabli.github.io/extension-hierarchy-navigator-multiselect/).
2. Download the [network-enabled manifest](https://bschabli.github.io/extension-hierarchy-navigator-multiselect/hierarchynavigator-multiselect.trex).
3. In Tableau, add an Extension, choose **My Extensions**, and select the downloaded manifest.
4. Configure the hierarchy source worksheet and any target worksheet/filter mappings.

The hosted extension URL is:

`https://bschabli.github.io/extension-hierarchy-navigator-multiselect/hierarchynavigator.html`

Tableau Cloud and Tableau Server administrators must add that exact network-enabled URL to the site safe list and allow the required data access before the extension can run.

The included [sample workbook](https://bschabli.github.io/extension-hierarchy-navigator-multiselect/Hierarchy%20Navigator%20Extension%20v2.twbx) can be used as a starting point.

## Local development

Install Node.js 22.15 or newer, then install dependencies and start the development server:

```sh
npm install --legacy-peer-deps
npm start
```

Use `src/hierarchynavigator-1.0.local.trex` with the local development server.

Build and validate the project with:

```sh
npm run typecheck
npm test
npm run build
```

## Local Tableau sandbox testing

The sandbox manifests are development manifests. They point to Tableau's local sandbox server and are not public hosted manifests.

```sh
npm run build
npm run sandbox
```

Then load `src/hierarchynavigator-1.0.local.sandboxed.trex` in Tableau. The source URL matches the extension name and port in `sandbox-config.json`:

`http://localhost:8765/sandbox/extension-hierarchy-navigator-multiselect/hierarchynavigator.html`

A generally available sandboxed extension must be reviewed and hosted by Tableau. Until that publishing process is complete, use the GitHub Pages manifest as a network-enabled extension or use the local sandbox workflow above.

## Deployment

Pushes to `master` are built and deployed to GitHub Pages by `.github/workflows/pages.yml`. Pull requests run the type-check, test, manifest-validation, and production-build workflow before merging.

## License

See [LICENSE](LICENSE).
