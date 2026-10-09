# Hierarchy Navigator / Filter — Tableau Viz Extension

**Hierarchy Navigator** is a standalone Tableau Viz Extension for hierarchical navigation and multi-select filtering. It supports search, expansion, breadcrumbs, level actions and keyboard navigation. Use its native worksheet selection as the source of Tableau filter actions for your dashboard.

## Add the Viz Extension

Requires Tableau **2024.2 or later** with Viz Extensions enabled. The worksheet manifest requests summary data only; it does not request full underlying-data access.

1. Run `npm ci` and `npm start` (Node.js 22.15 or later).
2. In a worksheet's **Marks** card, choose **Add Extension → Access Local Extensions**.
3. Open `src/hierarchy-viz.local.trex`.
4. Add discrete dimensions to the encoding tiles:

| Encoding | Flat / dimensional hierarchy | Recursive hierarchy |
| --- | --- | --- |
| Hierarchy | Ordered level fields, from root to leaf | Exactly one label field |
| Node ID | One unique, non-null key per summary row | One unique, non-null node key |
| Parent ID | Leave empty | Parent key; null for roots |

Keep one summary row per Node ID. Additional Detail fields may split rows and introduce duplicate IDs. The extension reports duplicate/blank IDs and cycles instead of silently rendering ambiguous data. Missing intermediate flat levels are skipped; orphaned recursive nodes remain visible with a validation notice (for example after worksheet filtering).

The production manifest is `src/hierarchy-viz.trex`; it points to `https://bschabli.github.io/extension-hierarchy-navigator-multiselect/hierarchy-viz.html`. This URL becomes available when the new build is deployed. The exact URL must be allowed by your Tableau Cloud/Server administrator. The production and local manifests represent the same Viz Extension.

## Navigator and filter behavior

- Flat and recursive hierarchies with checkbox multi-selection and partial parent states.
- Parent selection: terminal descendants, entire subtree, or direct node only.
- Native worksheet mark selection, including synchronization when Tableau clears/changes selection.
- Fuzzy search, highlighted matches, ancestor context, breadcrumbs and recent items.
- Selected-only view and level-specific expand, collapse, select and clear actions.
- Virtualized rows above 250 visible nodes, paged summary-data loading and incremental tree reuse.
- Refreshes on `SummaryDataChanged`, with stale results discarded and readers released.
- Keyboard navigation and tree semantics; English and German UI.
- Compact layout, saved navigator preferences and versioned JSON preference import/export.
- Row/node counts and actionable loading, setup, validation and output errors.

In **Settings**, authors can save density and parent-selection behavior in the workbook. Viewers can adjust their current navigator settings without changing saved workbook settings. Search and expansion are remembered for the browser session; Tableau remains the source of truth for mark selection.

### Filtering and parameters

A Viz Extension runs in its own worksheet. Selection is sent to that worksheet using native mark-selection APIs. Configure **Tableau filter, highlight or parameter actions** from that worksheet to other views as required. The Viz Extension does not enumerate or directly mutate unrelated dashboard worksheets. Parent-selection behavior determines which node IDs are selected; clearing selection uses Tableau's native clear operation.

## Migration from the dashboard extension

Existing dashboard extensions cannot be converted in place by swapping a manifest: Tableau uses a different extension host. Add a worksheet Viz Extension, assign its encodings, configure the desired Tableau actions, then place that worksheet on your dashboard. Verify behavior before removing the old dashboard object.

The original `hierarchynavigator-1.0*.trex` manifests, `hierarchynavigator.html`, configuration dialog and sample workbooks remain as **dashboard compatibility artifacts**. Existing workbooks retain their direct filter mappings and parameter-output integration. Old dashboard configuration exports describe source/target worksheets and are not Viz navigator-settings files; recreate those mappings using encodings and native actions. The shared tree renderer also serves the compatibility extension.

The new primary entry point and landing page no longer depend on the fork's screenshot-based onboarding, legacy dashboard wizard, `extend` or `react-simple-tree-menu`. The external tree-menu dependency has been removed entirely. The Viz entry point vendors the official Tableau API 1.14 library at an explicit version; it uses APIs available since 1.12. Dashboard compatibility keeps its previous API library.

## Development and verification

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run test:host
```

`test:host` serves a **local-only simulated Tableau host** at `http://127.0.0.1:8081`. Build first. It supports flat/recursive fixtures, 600-node data, data-change events and external selection clearing. It is not included in the published extension. Use it to inspect navigation, selection preservation, search, settings and keyboard navigation. It does not replace an integration test inside Tableau.

Unit tests cover encoding/field-ID resolution, raw versus formatted IDs, validation, empty datasets, visible rows, refresh coalescing, disposal, reader cleanup and serialized mark selection, alongside the existing hierarchy tests. Before release, also verify real worksheet field drops/reordering, Tableau selection/filter/parameter actions, workbook save/reopen and Server/Cloud security settings.

Architecture:

- `src/components/viz/VizModel.ts`: typed encoding bindings and hierarchy validation.
- `src/components/viz/VizRuntime.ts`: worksheet refresh and native selection lifecycle.
- `src/components/viz/HierarchyViz.tsx`: initialization, settings and the navigator application shell.
- `src/components/extension/Hierarchy.tsx` and `VisibleTree.tsx`: navigator rows, interaction and virtualization.
- `src/css/viz.css`: navigator appearance and responsive layout.

Pushes to `master` build and deploy `docs/` via GitHub Pages. Pull requests run type-checking, tests, XML validation and a production build. Webpack currently reports bundle-size advisories; these are not build failures.

## Tableau references

- [Create a Viz Extension](https://tableau.github.io/extensions-api/docs/vizext/trex_viz_create/)
- [Viz manifest and encoding definitions](https://tableau.github.io/extensions-api/docs/vizext/trex_viz_manifest/)
- [Paged summary data](https://tableau.github.io/extensions-api/docs/core/trex_getdata/)
- [Official vendored API library](https://github.com/tableau/extensions-api/blob/main/lib/previous/tableau.extensions.1.14.0.min.js)

## License

See [LICENSE](LICENSE). Original third-party attributions are preserved.
