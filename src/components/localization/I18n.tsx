import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';

export type InterfaceLocale='de'|'en';
export type TranslationValues=Record<string, string|number>;

interface LocalizationContextValue {
    locale: InterfaceLocale;
    t: (message: string, values?: TranslationValues) => string;
}

const GERMAN_TRANSLATIONS: Record<string, string>={
    '{count} matching item': '{count} passender Eintrag',
    '{count} matching items': '{count} passende Einträge',
    '{count} preview value selected': '{count} Vorschauwert ausgewählt',
    '{count} preview values selected': '{count} Vorschauwerte ausgewählt',
    '{count} sibling branches expanded.': '{count} benachbarte Zweige erweitert.',
    '{count} value is selected.': '{count} Wert ist ausgewählt.',
    '{count} value selected': '{count} Wert ausgewählt',
    '{count} values are selected.': '{count} Werte sind ausgewählt.',
    '{count} values selected': '{count} Werte ausgewählt',
    'About this project': 'Über dieses Projekt',
    'Accessibility': 'Barrierefreiheit',
    'Add': 'Hinzufügen',
    'Add another worksheet': 'Weiteres Arbeitsblatt hinzufügen',
    'All {count} values selected.': 'Alle {count} Werte ausgewählt.',
    'All values are shown with no filter.': 'Alle Werte werden ohne Filter angezeigt.',
    'All values shown (no filter)': 'Alle Werte angezeigt (kein Filter)',
    'Apply the complete selection to filters on multiple Tableau worksheets.': 'Die gesamte Auswahl auf Filter mehrerer Tableau-Arbeitsblätter anwenden.',
    'Automatic': 'Automatisch',
    'Back': 'Zurück',
    'Background color': 'Hintergrundfarbe',
    'Base64 image': 'Base64-Bild',
    'Building the preview from the source worksheet…': 'Vorschau wird aus dem Quellarbeitsblatt erstellt…',
    'Cancel': 'Abbrechen',
    'Choose how selecting a hierarchy item changes the shared worksheet filter.': 'Wählen Sie, wie die Auswahl eines Hierarchieeintrags den gemeinsamen Arbeitsblattfilter ändert.',
    'Choose the format used by the dedicated source worksheet. The worksheet can be hidden after configuration.': 'Wählen Sie das Format des dedizierten Quellarbeitsblatts. Das Arbeitsblatt kann nach der Konfiguration ausgeblendet werden.',
    'Choose the shape of your data': 'Form der Daten auswählen',
    'Choose what selection controls': 'Auswirkungen der Auswahl festlegen',
    'Clear': 'Löschen',
    'Closed icon': 'Symbol für geschlossen',
    'Collapse {label}': '{label} einklappen',
    'Collapsed icon': 'Symbol für eingeklappt',
    'Complete the required source fields before saving.': 'Füllen Sie vor dem Speichern die erforderlichen Quellfelder aus.',
    'Complete the source mapping to build the live preview.': 'Vervollständigen Sie die Quellzuordnung, um die Live-Vorschau zu erstellen.',
    'Configuration': 'Konfiguration',
    'Configuration progress': 'Konfigurationsfortschritt',
    'Configure': 'Konfigurieren',
    'Configure Hierarchy Navigator': 'Hierarchy Navigator konfigurieren',
    'Confirm settings and appearance': 'Einstellungen und Darstellung prüfen',
    'Continue': 'Weiter',
    'Dashboard actions': 'Dashboard-Aktionen',
    'Data validation': 'Datenprüfung',
    'Default': 'Standard',
    'Description': 'Beschreibung',
    'Dimensional': 'Dimensional',
    'Direct node only': 'Nur direkter Knoten',
    'Download the multiselect test manifest': 'Multiselect-Testmanifest herunterladen',
    'Drag to reorder': 'Ziehen, um die Reihenfolge zu ändern',
    'English': 'Englisch',
    'Enter custom text or a symbol.': 'Benutzerdefinierten Text oder ein Symbol eingeben.',
    'Entire subtree': 'Gesamter Teilbaum',
    'Expand {label}': '{label} ausklappen',
    'Expanded icon': 'Symbol für ausgeklappt',
    'Filter field': 'Filterfeld',
    'Fix the data issues shown above before saving.': 'Beheben Sie vor dem Speichern die oben angezeigten Datenprobleme.',
    'Fix the validation issues above to unlock the live preview.': 'Beheben Sie die Prüfprobleme oben, um die Live-Vorschau freizuschalten.',
    'Flat and recursive Tableau hierarchies with checkbox selection': 'Flache und rekursive Tableau-Hierarchien mit Kontrollkästchenauswahl',
    'Font color': 'Schriftfarbe',
    'Font family': 'Schriftfamilie',
    'Font size': 'Schriftgröße',
    'German': 'Deutsch',
    'Handle incomplete Flat paths without visible NULL nodes.': 'Unvollständige flache Pfade ohne sichtbare NULL-Knoten verarbeiten.',
    'Hierarchy format': 'Hierarchieformat',
    'Hierarchy Navigator could not start': 'Hierarchy Navigator konnte nicht gestartet werden',
    'Hierarchy Navigator Multiselect': 'Hierarchy Navigator Multiselect',
    'Hierarchy navigator': 'Hierarchienavigation',
    'Hierarchy preview': 'Hierarchievorschau',
    'Hierarchy updated. {count} item is available.': 'Hierarchie aktualisiert. {count} Eintrag ist verfügbar.',
    'Hierarchy updated. {count} items are available.': 'Hierarchie aktualisiert. {count} Einträge sind verfügbar.',
    'Highlight color': 'Hervorhebungsfarbe',
    'How is your hierarchy stored?': 'Wie ist Ihre Hierarchie gespeichert?',
    'ID field': 'ID-Feld',
    'In Tableau, add an Extension and choose My Extensions, then select the downloaded manifest.': 'Fügen Sie in Tableau eine Erweiterung hinzu, wählen Sie Meine Erweiterungen und anschließend das heruntergeladene Manifest.',
    'Interface language': 'Oberflächensprache',
    'Keep expanded branches, search text, and valid selections through dashboard data refreshes.': 'Ausgeklappte Zweige, Suchtext und gültige Auswahlen bei Dashboard-Aktualisierungen beibehalten.',
    'Label field': 'Beschriftungsfeld',
    'Language follows the Tableau or browser locale. Add ?lang=en or ?lang=de to the URL to override it.': 'Die Sprache folgt der Tableau- oder Browsereinstellung. Mit ?lang=en oder ?lang=de in der URL kann sie überschrieben werden.',
    'Level fields': 'Ebenenfelder',
    'Live hierarchy preview': 'Live-Hierarchievorschau',
    'Loading…': 'Wird geladen…',
    'Map the worksheet and fields': 'Arbeitsblatt und Felder zuordnen',
    'Multiple target worksheets': 'Mehrere Zielarbeitsblätter',
    'Navigate the hierarchy fully by keyboard with visible focus and screen-reader announcements.': 'Die Hierarchie vollständig per Tastatur mit sichtbarem Fokus und Screenreader-Ansagen bedienen.',
    'New to the extension? Follow the four steps below. The source hierarchy should live on its own worksheet; it can be hidden after setup.': 'Neu bei der Erweiterung? Folgen Sie den vier Schritten unten. Die Quellhierarchie sollte auf einem eigenen Arbeitsblatt liegen; dieses kann nach der Einrichtung ausgeblendet werden.',
    'Next': 'Weiter',
    'No hierarchy items match “{term}”.': 'Keine Hierarchieeinträge entsprechen „{term}“.',
    'No items': 'Keine Einträge',
    'No items match “{term}”': 'Keine Einträge entsprechen „{term}“',
    'No valid sheets on the dashboard': 'Keine gültigen Arbeitsblätter im Dashboard',
    'Not configured': 'Nicht konfiguriert',
    'Not selected': 'Nicht ausgewählt',
    'Not sure?': 'Nicht sicher?',
    'Opened icon': 'Symbol für geöffnet',
    'Options': 'Optionen',
    'Parent and child rows': 'Über- und untergeordnete Zeilen',
    'Parent field': 'Übergeordnetes Feld',
    'partially selected': 'teilweise ausgewählt',
    'Previous': 'Zurück',
    'Preview only': 'Nur Vorschau',
    'Recursive': 'Rekursiv',
    'Recommended': 'Empfohlen',
    'Reload Extension': 'Erweiterung neu laden',
    'Reload the extension after confirming that its exact URL is enabled in Tableau Settings → Extensions.': 'Laden Sie die Erweiterung neu, nachdem Sie geprüft haben, dass ihre genaue URL unter Tableau-Einstellungen → Erweiterungen zugelassen ist.',
    'Remove': 'Entfernen',
    'Remove {label}': '{label} entfernen',
    'Reset preview': 'Vorschau zurücksetzen',
    'Reset Selections': 'Auswahl zurücksetzen',
    'Review & display': 'Prüfen & darstellen',
    'Save configuration': 'Konfiguration speichern',
    'Search hierarchy': 'Hierarchie durchsuchen',
    'Search preview hierarchy': 'Vorschauhierarchie durchsuchen',
    'Select all': 'Alle auswählen',
    'Select all hierarchy values': 'Alle Hierarchiewerte auswählen',
    'Select leaves across multiple branches.': 'Endknoten über mehrere Zweige hinweg auswählen.',
    'Select or clear an entire parent subtree.': 'Einen gesamten übergeordneten Teilbaum auswählen oder leeren.',
    'Select the downloaded manifest.': 'Wählen Sie das heruntergeladene Manifest aus.',
    'Select the sheet with the hierarchy data': 'Arbeitsblatt mit den Hierarchiedaten auswählen',
    'Select the source hierarchy and any target worksheet filters before using the extension.': 'Wählen Sie vor der Verwendung die Quellhierarchie und die Filter der Zielarbeitsblätter aus.',
    'selected': 'ausgewählt',
    'Selections reset. All values are shown.': 'Auswahl zurückgesetzt. Alle Werte werden angezeigt.',
    'Separate level columns': 'Separate Ebenenspalten',
    'Setup in progress': 'Einrichtung läuft',
    'Show search': 'Suche anzeigen',
    'Show title': 'Titel anzeigen',
    'Showing the first {count} visible items': 'Die ersten {count} sichtbaren Einträge werden angezeigt',
    'Source data': 'Quelldaten',
    'Source ready': 'Quelle bereit',
    'Step {current} of {total}': 'Schritt {current} von {total}',
    'Target worksheet': 'Zielarbeitsblatt',
    'Test the Extension': 'Erweiterung testen',
    'The preview is unavailable because the source data could not be read.': 'Die Vorschau ist nicht verfügbar, da die Quelldaten nicht gelesen werden konnten.',
    'This fork extends the open-source Tableau Hierarchy Navigator with shared checkbox multi-selection for Flat/Dimensional and Recursive hierarchies.': 'Dieser Fork erweitert den quelloffenen Tableau Hierarchy Navigator um eine gemeinsame Mehrfachauswahl mit Kontrollkästchen für flache/dimensionale und rekursive Hierarchien.',
    'Title': 'Titel',
    'Try search, expand branches, and select items before saving. Preview interactions never change the dashboard.': 'Probieren Sie vor dem Speichern Suche, Ausklappen und Auswahl aus. Aktionen in der Vorschau verändern das Dashboard nicht.',
    'Type and search': 'Eingeben und suchen',
    'Use the included sample workbook as a starting point if needed.': 'Verwenden Sie bei Bedarf die enthaltene Beispielarbeitsmappe als Ausgangspunkt.',
    'Use Up and Down Arrow to move, Right Arrow to expand or enter a branch, Left Arrow to collapse or return to a parent, Home and End to jump, Space or Enter to select, and type letters to find an item.': 'Mit Pfeil nach oben und unten navigieren, mit Pfeil nach rechts einen Zweig öffnen oder betreten, mit Pfeil nach links einklappen oder zum übergeordneten Eintrag wechseln, mit Pos1 und Ende springen, mit Leertaste oder Eingabetaste auswählen und durch Tippen von Buchstaben einen Eintrag finden.',
    'Validate IDs, labels, parent relationships, cycles, and hierarchy paths before saving.': 'IDs, Beschriftungen, übergeordnete Beziehungen, Zyklen und Hierarchiepfade vor dem Speichern prüfen.',
    'Validation must finish successfully before saving.': 'Die Prüfung muss vor dem Speichern erfolgreich abgeschlossen sein.',
    'View source and documentation on GitHub': 'Quellcode und Dokumentation auf GitHub anzeigen',
    'Waiting to validate the source worksheet…': 'Quellarbeitsblatt wartet auf Prüfung…',
    'Worksheet': 'Arbeitsblatt',
    'not selectable': 'nicht auswählbar',
    'not selected': 'nicht ausgewählt',
    '{label} collapsed.': '{label} eingeklappt.',
    '{label} deselected.': '{label} abgewählt.',
    '{label} expanded.': '{label} ausgeklappt.',
    '{label} selected.': '{label} ausgewählt.'
    ,'A stable, unique ID for each hierarchy item.': 'Eine stabile, eindeutige ID für jeden Hierarchieeintrag.'
    ,'A worksheet that should react to hierarchy selections.': 'Ein Arbeitsblatt, das auf Hierarchieauswahlen reagieren soll.'
    ,'Add all': 'Alle hinzufügen'
    ,'Add at least one worksheet to enable dashboard filtering.': 'Fügen Sie mindestens ein Arbeitsblatt hinzu, um Dashboard-Filterung zu aktivieren.'
    ,'Add fields to the left column and drag them into order. Start with the root level.': 'Fügen Sie Felder zur linken Spalte hinzu und ziehen Sie sie in die richtige Reihenfolge. Beginnen Sie mit der Wurzelebene.'
    ,'Advanced appearance': 'Erweiterte Darstellung'
    ,'Advanced dashboard synchronization': 'Erweiterte Dashboard-Synchronisierung'
    ,'Advanced: write values to parameters': 'Erweitert: Werte in Parameter schreiben'
    ,'All available fields are selected.': 'Alle verfügbaren Felder sind ausgewählt.'
    ,'All available worksheets are already configured.': 'Alle verfügbaren Arbeitsblätter sind bereits konfiguriert.'
    ,'Also write the selected item label to a parameter': 'Beschriftung des ausgewählten Eintrags ebenfalls in einen Parameter schreiben'
    ,'Apply selection as a filter': 'Auswahl als Filter anwenden'
    ,'Apply selection as filters': 'Auswahl als Filter anwenden'
    ,'Apply the selected hierarchy IDs to one or more worksheets. Each worksheet can use its own matching filter field.': 'Wenden Sie die ausgewählten Hierarchie-IDs auf ein oder mehrere Arbeitsblätter an. Jedes Arbeitsblatt kann ein eigenes passendes Filterfeld verwenden.'
    ,'Ascii': 'ASCII'
    ,'Automatically expand matching paths': 'Passende Pfade automatisch ausklappen'
    ,'Automatically expand matching search paths': 'Passende Suchpfade automatisch ausklappen'
    ,'Available fields': 'Verfügbare Felder'
    ,'Base64 Image': 'Base64-Bild'
    ,'CSS for items': 'CSS für Einträge'
    ,'Check the current source worksheet for structural problems before saving. Trailing blank levels in variable-depth hierarchies are allowed.': 'Prüfen Sie das aktuelle Quellarbeitsblatt vor dem Speichern auf strukturelle Probleme. Leere abschließende Ebenen in Hierarchien variabler Tiefe sind zulässig.'
    ,'Checking source data': 'Quelldaten werden geprüft'
    ,'Checking the source worksheet before saving…': 'Quellarbeitsblatt wird vor dem Speichern geprüft…'
    ,'Child ID': 'Untergeordnete ID'
    ,'Child ID field': 'Feld für untergeordnete ID'
    ,'Choose a worksheet, at least one level, and an ID field': 'Wählen Sie ein Arbeitsblatt, mindestens eine Ebene und ein ID-Feld'
    ,'Choose background color': 'Hintergrundfarbe auswählen'
    ,'Choose font color': 'Schriftfarbe auswählen'
    ,'Choose highlight color': 'Hervorhebungsfarbe auswählen'
    ,'Choose separate level columns if your Tableau view already contains one dimension for every hierarchy level.': 'Wählen Sie separate Ebenenspalten, wenn Ihre Tableau-Ansicht bereits eine Dimension für jede Hierarchieebene enthält.'
    ,'Choose the calculated field that contains the full hierarchy path.': 'Wählen Sie das berechnete Feld mit dem vollständigen Hierarchiepfad.'
    ,'Choose the dedicated worksheet that contains the parent-and-child relationship.': 'Wählen Sie das dedizierte Arbeitsblatt mit der über- und untergeordneten Beziehung.'
    ,'Choose the hierarchy worksheet, then build the hierarchy from broadest level to most detailed level.': 'Wählen Sie das Hierarchiearbeitsblatt und erstellen Sie die Hierarchie von der allgemeinsten bis zur detailliertesten Ebene.'
    ,'Choose what a selection controls': 'Festlegen, was eine Auswahl steuert'
    ,'Choose whether a parent selects terminal values, its entire subtree, or only its own direct ID.': 'Wählen Sie, ob ein übergeordneter Eintrag Endwerte, den gesamten Teilbaum oder nur seine eigene direkte ID auswählt.'
    ,'Choose which IDs a checkbox sends to every configured target filter field.': 'Wählen Sie, welche IDs ein Kontrollkästchen an alle konfigurierten Zielfilterfelder sendet.'
    ,'Closed icon type': 'Symboltyp für geschlossen'
    ,'Colors and typography': 'Farben und Typografie'
    ,'Colors, typography, row styles, and hierarchy icons.': 'Farben, Typografie, Zeilenstile und Hierarchiesymbole.'
    ,'Complete the source worksheet and field mapping to run validation.': 'Vervollständigen Sie Quellarbeitsblatt und Feldzuordnung, um die Prüfung auszuführen.'
    ,'Configuration summary': 'Konfigurationsübersicht'
    ,'Configure the hierarchy source worksheet, ordered fields or recursive IDs, and one or more target worksheet/filter mappings.': 'Konfigurieren Sie das Hierarchie-Quellarbeitsblatt, geordnete Felder oder rekursive IDs sowie eine oder mehrere Zuordnungen von Zielarbeitsblatt und Filter.'
    ,'Confirm the data mapping and interactions, then choose the display options users will see.': 'Prüfen Sie Datenzuordnung und Interaktionen und wählen Sie anschließend die sichtbaren Darstellungsoptionen.'
    ,'Create or update {field} with this formula, then reopen configuration if needed.': 'Erstellen oder aktualisieren Sie {field} mit dieser Formel und öffnen Sie die Konfiguration bei Bedarf erneut.'
    ,'Create string parameters in Tableau first, then map them here. Leave these off if filtering is all you need.': 'Erstellen Sie zuerst Zeichenfolgenparameter in Tableau und ordnen Sie sie anschließend hier zu. Lassen Sie diese deaktiviert, wenn Filterung ausreicht.'
    ,'Current selected level (1…n)': 'Aktuell ausgewählte Ebene (1…n)'
    ,'Custom item CSS and diagnostic logging.': 'Benutzerdefiniertes Eintrags-CSS und Diagnoseprotokollierung.'
    ,'Dashboard filters': 'Dashboard-Filter'
    ,'Data issues need attention': 'Datenprobleme müssen behoben werden'
    ,'Data validation preview': 'Vorschau der Datenprüfung'
    ,'Developer settings': 'Entwicklereinstellungen'
    ,'Display': 'Darstellung'
    ,'Display label field': 'Feld für Anzeigebeschriftung'
    ,'Each ID should uniquely identify a node. The label is the friendly name shown in the navigator.': 'Jede ID sollte einen Knoten eindeutig identifizieren. Die Beschriftung ist der verständliche Name im Navigator.'
    ,'Enable dashboard parameter listeners': 'Dashboard-Parameterüberwachung aktivieren'
    ,'Enable debug logging': 'Debug-Protokollierung aktivieren'
    ,'Enable parameter listeners': 'Parameterüberwachung aktivieren'
    ,'Enable source mark selection': 'Markierungsauswahl im Quellarbeitsblatt aktivieren'
    ,'Enable this only when the dashboard should update the navigator from {parameterType} parameters.': 'Aktivieren Sie dies nur, wenn das Dashboard den Navigator über Parameter für {parameterType} aktualisieren soll.'
    ,'Every populated ID appears once.': 'Jede ausgefüllte ID kommt genau einmal vor.'
    ,'Every populated parent ID exists in the source data.': 'Jede ausgefüllte übergeordnete ID ist in den Quelldaten vorhanden.'
    ,'Every required hierarchy label is populated.': 'Jede erforderliche Hierarchiebeschriftung ist ausgefüllt.'
    ,'Every row can be converted into an unambiguous hierarchy path.': 'Jede Zeile kann in einen eindeutigen Hierarchiepfad umgewandelt werden.'
    ,'Example table with one column for each hierarchy level': 'Beispieltabelle mit einer Spalte je Hierarchieebene'
    ,'Example table with parent and child columns': 'Beispieltabelle mit über- und untergeordneten Spalten'
    ,'Example: a field named Category with the default suffix maps to Category Param.': 'Beispiel: Ein Feld namens Category wird mit dem Standardsuffix dem Parameter Category Param zugeordnet.'
    ,'Expected Tableau formula': 'Erwartete Tableau-Formel'
    ,'Expose selected hierarchy values to calculations and parameter actions.': 'Ausgewählte Hierarchiewerte für Berechnungen und Parameteraktionen bereitstellen.'
    ,'Expose the selected item to calculations and parameter actions.': 'Den ausgewählten Eintrag für Berechnungen und Parameteraktionen bereitstellen.'
    ,'Extension title': 'Erweiterungstitel'
    ,'Field mapping': 'Feldzuordnung'
    ,'Filter dashboard worksheets': 'Dashboard-Arbeitsblätter filtern'
    ,'Filter target {count}': 'Filterziel {count}'
    ,'Filtering is off. The navigator will keep its selection internally unless another output below is enabled.': 'Die Filterung ist deaktiviert. Der Navigator behält seine Auswahl intern, sofern keine weitere Ausgabe unten aktiviert ist.'
    ,'Filtering is the usual choice. Parameters and source mark selection are optional integrations for more advanced dashboards.': 'Filterung ist die übliche Wahl. Parameter und Markierungsauswahl im Quellarbeitsblatt sind optionale Integrationen für erweiterte Dashboards.'
    ,'For parent/child data, every valid source row represents one node and its Child ID supplies the direct filter value.': 'Bei über-/untergeordneten Daten stellt jede gültige Quellzeile einen Knoten dar; seine untergeordnete ID liefert den direkten Filterwert.'
    ,'For separate level columns, a node has a direct value only when a source row ends at that level; the mapped Unique path ID supplies its filter value.': 'Bei separaten Ebenenspalten hat ein Knoten nur dann einen direkten Wert, wenn eine Quellzeile auf dieser Ebene endet; die zugeordnete eindeutige Pfad-ID liefert den Filterwert.'
    ,'Green checks are ready. Warnings mean the parameter still needs to be created or renamed in Tableau.': 'Grüne Häkchen sind bereit. Warnungen bedeuten, dass der Parameter in Tableau noch erstellt oder umbenannt werden muss.'
    ,'Hierarchy fields': 'Hierarchiefelder'
    ,'Hierarchy icons': 'Hierarchiesymbole'
    ,'Hierarchy levels': 'Hierarchieebenen'
    ,'IDs are unique': 'IDs sind eindeutig'
    ,'Icon preview': 'Symbolvorschau'
    ,'Increase this if the extension and dashboard repeatedly update one another or the dashboard responds slowly.': 'Erhöhen Sie diesen Wert, wenn sich Erweiterung und Dashboard wiederholt gegenseitig aktualisieren oder das Dashboard langsam reagiert.'
    ,'Invalid JSON: {message}': 'Ungültiges JSON: {message}'
    ,'Item ID parameter': 'Parameter für Eintrags-ID'
    ,'Item label parameter': 'Parameter für Eintragsbeschriftung'
    ,'Labels are populated': 'Beschriftungen sind ausgefüllt'
    ,'Leave off when the navigator is the only component controlling these parameters.': 'Deaktiviert lassen, wenn nur der Navigator diese Parameter steuert.'
    ,'Let dashboard parameters drive the navigator selection.': 'Dashboard-Parameter die Auswahl im Navigator steuern lassen.'
    ,'Let users quickly find items in larger hierarchies.': 'Benutzern das schnelle Finden von Einträgen in größeren Hierarchien ermöglichen.'
    ,'Listen for dashboard changes': 'Auf Dashboard-Änderungen reagieren'
    ,'Map all required fields to continue': 'Ordnen Sie alle erforderlichen Felder zu, um fortzufahren'
    ,'Map the source worksheet': 'Quellarbeitsblatt zuordnen'
    ,'Needs attention': 'Überprüfung erforderlich'
    ,'No compatible string or integer parameters were found on this dashboard.': 'Auf diesem Dashboard wurden keine kompatiblen Zeichenfolgen- oder Ganzzahlparameter gefunden.'
    ,'No fields available.': 'Keine Felder verfügbar.'
    ,'No item eventually points back to itself.': 'Kein Eintrag verweist über seine Beziehungen wieder auf sich selbst.'
    ,'No levels selected yet.': 'Noch keine Ebenen ausgewählt.'
    ,'No source rows were returned for validation.': 'Für die Prüfung wurden keine Quellzeilen zurückgegeben.'
    ,'Not available': 'Nicht verfügbar'
    ,'Off': 'Aus'
    ,'On': 'Ein'
    ,'Open icon type': 'Symboltyp für geöffnet'
    ,'Optional': 'Optional'
    ,'Parameter output': 'Parameterausgabe'
    ,'Parameter outputs': 'Parameterausgaben'
    ,'Parameters the extension expects': 'Von der Erweiterung erwartete Parameter'
    ,'Parent ID': 'Übergeordnete ID'
    ,'Parent ID field': 'Feld für übergeordnete ID'
    ,'Paste a Base64 image string below': 'Fügen Sie unten eine Base64-Bildzeichenfolge ein'
    ,'Path separator': 'Pfadtrennzeichen'
    ,'Paths are well-formed': 'Pfade sind korrekt aufgebaut'
    ,'Preview': 'Vorschau'
    ,'Reading and validating the source worksheet…': 'Quellarbeitsblatt wird gelesen und geprüft…'
    ,'Ready': 'Bereit'
    ,'Ready to save': 'Bereit zum Speichern'
    ,'Recommended when the navigator should control visible marks across the dashboard.': 'Empfohlen, wenn der Navigator sichtbare Markierungen im gesamten Dashboard steuern soll.'
    ,'Relationships contain no cycles': 'Beziehungen enthalten keine Zyklen'
    ,'Required': 'Erforderlich'
    ,'Required source fields are mapped': 'Erforderliche Quellfelder sind zugeordnet'
    ,'Reset all hierarchy selections': 'Alle Hierarchieauswahlen zurücksetzen'
    ,'Retry validation': 'Prüfung wiederholen'
    ,'Review and finish': 'Prüfen und abschließen'
    ,'Run again': 'Erneut ausführen'
    ,'Search': 'Suche'
    ,'Search box': 'Suchfeld'
    ,'Search with highlighted matches, retained ancestor context, and optional automatic path expansion.': 'Mit hervorgehobenen Treffern, beibehaltenem Vorgängerkontext und optional automatisch ausgeklappten Pfaden suchen.'
    ,'See checked and indeterminate parent states.': 'Ausgewählte und teilweise ausgewählte Zustände übergeordneter Einträge erkennen.'
    ,'Select at least one hierarchy level to generate the formula.': 'Wählen Sie mindestens eine Hierarchieebene aus, um die Formel zu erzeugen.'
    ,'Select marks on the source worksheet': 'Markierungen im Quellarbeitsblatt auswählen'
    ,'Select {label} in preview': '{label} in der Vorschau auswählen'
    ,'Selected label parameter': 'Parameter für ausgewählte Beschriftung'
    ,'Selected levels': 'Ausgewählte Ebenen'
    ,'Selected value for this hierarchy level': 'Ausgewählter Wert für diese Hierarchieebene'
    ,'Selection behavior': 'Auswahlverhalten'
    ,'Set': 'Festlegen'
    ,'Show a short heading above the navigator.': 'Eine kurze Überschrift über dem Navigator anzeigen.'
    ,'Show extension title': 'Erweiterungstitel anzeigen'
    ,'Show search box': 'Suchfeld anzeigen'
    ,'Source mapping is incomplete': 'Quellzuordnung ist unvollständig'
    ,'Source mark selection': 'Markierungsauswahl im Quellarbeitsblatt'
    ,'Source worksheet': 'Quellarbeitsblatt'
    ,'Suffix for all parameters': 'Suffix für alle Parameter'
    ,'Target filter field': 'Zielfilterfeld'
    ,'Tell the navigator which row identifies a hierarchy item, which row is its parent, and what users should see.': 'Legen Sie fest, welche Zeile einen Hierarchieeintrag bezeichnet, welche sein übergeordneter Eintrag ist und was Benutzer sehen sollen.'
    ,'Terminal values only': 'Nur Endwerte'
    ,'Testing note:': 'Testhinweis:'
    ,'The ID of this row’s direct parent. Root rows may be null.': 'Die ID des direkten übergeordneten Eintrags dieser Zeile. Wurzelzeilen dürfen leer sein.'
    ,'The extension looks for parameters named after each hierarchy field plus the suffix below. Create them in Tableau before enabling this integration.': 'Die Erweiterung sucht nach Parametern, die nach jedem Hierarchiefeld plus dem unten angegebenen Suffix benannt sind. Erstellen Sie sie in Tableau, bevor Sie diese Integration aktivieren.'
    ,'The extension uses one calculated field to distinguish identical labels that appear under different parents.': 'Die Erweiterung verwendet ein berechnetes Feld, um identische Beschriftungen unter verschiedenen übergeordneten Einträgen zu unterscheiden.'
    ,'The field whose values match the selected hierarchy IDs.': 'Das Feld, dessen Werte den ausgewählten Hierarchie-IDs entsprechen.'
    ,'The text users will see next to each checkbox.': 'Der Text, den Benutzer neben jedem Kontrollkästchen sehen.'
    ,'These defaults work well in most dashboards and can be changed later.': 'Diese Standardwerte eignen sich für die meisten Dashboards und können später geändert werden.'
    ,'This check does not apply to the selected hierarchy format.': 'Diese Prüfung gilt nicht für das ausgewählte Hierarchieformat.'
    ,'This is a proof-of-concept build hosted from the multiselect feature branch.': 'Dies ist ein Proof-of-Concept-Build aus dem Multiselect-Feature-Branch.'
    ,'This node only': 'Nur dieser Knoten'
    ,'This worksheet supplies the hierarchy values. It may be hidden on the finished dashboard.': 'Dieses Arbeitsblatt liefert die Hierarchiewerte. Im fertigen Dashboard kann es ausgeblendet werden.'
    ,'Title text': 'Titeltext'
    ,'Try the configured hierarchy in a live, dashboard-safe preview before saving.': 'Die konfigurierte Hierarchie vor dem Speichern in einer sicheren Live-Vorschau testen, die das Dashboard nicht verändert.'
    ,'Turn this off when users should open matching ancestor branches themselves.': 'Deaktivieren Sie dies, wenn Benutzer passende übergeordnete Zweige selbst öffnen sollen.'
    ,'Unique ID of the selected item': 'Eindeutige ID des ausgewählten Eintrags'
    ,'Unique path ID': 'Eindeutige Pfad-ID'
    ,'Unique path ID field': 'Feld für eindeutige Pfad-ID'
    ,'Unknown Tableau Extensions API error.': 'Unbekannter Fehler der Tableau Extensions API.'
    ,'Update delay (milliseconds)': 'Aktualisierungsverzögerung (Millisekunden)'
    ,'Use any ASCII character(s)': 'Beliebige ASCII-Zeichen verwenden'
    ,'Use the included': 'Verwenden Sie die enthaltene'
    ,'Use this when each level—such as Category, Sub-category, and Product—has its own field.': 'Verwenden Sie dieses Format, wenn jede Ebene – etwa Kategorie, Unterkategorie und Produkt – ein eigenes Feld besitzt.'
    ,'Use this when every row identifies one item and its parent, such as Manager ID and Employee ID.': 'Verwenden Sie dieses Format, wenn jede Zeile einen Eintrag und seinen übergeordneten Eintrag angibt, etwa Manager-ID und Mitarbeiter-ID.'
    ,'Useful for dashboard actions that start from selected marks on the source sheet.': 'Nützlich für Dashboard-Aktionen, die von ausgewählten Markierungen im Quellarbeitsblatt ausgehen.'
    ,'Validation could not finish': 'Prüfung konnte nicht abgeschlossen werden'
    ,'Validation has not run': 'Prüfung wurde noch nicht ausgeführt'
    ,'Validation passed': 'Prüfung bestanden'
    ,'Visible label of the selected item': 'Sichtbare Beschriftung des ausgewählten Eintrags'
    ,'Visually select the matching marks in the hierarchy source worksheet. This is separate from filtering a target worksheet.': 'Wählen Sie die passenden Markierungen im Hierarchie-Quellarbeitsblatt sichtbar aus. Dies ist unabhängig von der Filterung eines Zielarbeitsblatts.'
    ,'What “direct ID” means:': 'Bedeutung von „direkte ID“:'
    ,'Write selected child ID to a parameter': 'Ausgewählte untergeordnete ID in einen Parameter schreiben'
    ,'Write selected child label to a parameter': 'Ausgewählte untergeordnete Beschriftung in einen Parameter schreiben'
    ,'Write selected item ID to a parameter': 'ID des ausgewählten Eintrags in einen Parameter schreiben'
    ,'Write selected item label to a parameter': 'Beschriftung des ausgewählten Eintrags in einen Parameter schreiben'
    ,'ancestor context shown': 'Kontext übergeordneter Einträge wird angezeigt'
    ,'as a starting point if needed.': 'bei Bedarf als Ausgangspunkt.'
    ,'auto-expand {state}': 'automatisch ausklappen: {state}'
    ,'item ID or label': 'Eintrags-ID oder Beschriftung'
    ,'off': 'aus'
    ,'on': 'ein'
    ,'sample workbook': 'Beispielarbeitsmappe'
    ,'the ID field': 'das ID-Feld'
    ,'the selected label': 'die ausgewählte Beschriftung'
    ,'{label} has been selected': '{label} wurde ausgewählt'
    ,'{count} worksheet': '{count} Arbeitsblatt'
    ,'{count} worksheets': '{count} Arbeitsblätter'
    ,'{count} match': '{count} Treffer'
    ,'{count} matches': '{count} Treffer'
    ,'{count} selectable value': '{count} auswählbarer Wert'
    ,'{count} selectable values': '{count} auswählbare Werte'
    ,'{count} data issue found': '{count} Datenproblem gefunden'
    ,'{count} data issues found': '{count} Datenprobleme gefunden'
    ,'{count} source row checked.': '{count} Quellzeile geprüft.'
    ,'{count} source rows checked.': '{count} Quellzeilen geprüft.'
    ,'{count} ID appears more than once.': '{count} ID kommt mehrfach vor.'
    ,'{count} IDs appear more than once.': '{count} IDs kommen mehrfach vor.'
    ,'{count} child references a parent that is not present.': '{count} untergeordneter Eintrag verweist auf einen nicht vorhandenen übergeordneten Eintrag.'
    ,'{count} children reference a parent that is not present.': '{count} untergeordnete Einträge verweisen auf einen nicht vorhandenen übergeordneten Eintrag.'
    ,'{count} circular relationship was found.': '{count} zyklische Beziehung wurde gefunden.'
    ,'{count} circular relationships were found.': '{count} zyklische Beziehungen wurden gefunden.'
    ,'{count} row has a required blank label.': '{count} Zeile enthält eine erforderliche leere Beschriftung.'
    ,'{count} rows have a required blank label.': '{count} Zeilen enthalten eine erforderliche leere Beschriftung.'
    ,'{count} malformed hierarchy path was found.': '{count} fehlerhafter Hierarchiepfad wurde gefunden.'
    ,'{count} malformed hierarchy paths were found.': '{count} fehlerhafte Hierarchiepfade wurden gefunden.'
    ,'Children have known parents': 'Untergeordnete Einträge haben bekannte übergeordnete Einträge'
    ,'Confirm that the source worksheet contains visible, unfiltered hierarchy rows.': 'Prüfen Sie, ob das Quellarbeitsblatt sichtbare, ungefilterte Hierarchiezeilen enthält.'
    ,'A parent selects only the visual leaves below it. Intermediate node IDs are not included.': 'Ein übergeordneter Eintrag wählt nur die sichtbaren Endknoten darunter aus. IDs von Zwischenknoten werden nicht einbezogen.'
    ,'Furniture → Atlantic, Bush, Hon': 'Möbel → Atlantic, Bush, Hon'
    ,'A parent selects its own direct ID plus every directly represented node below it.': 'Ein übergeordneter Eintrag wählt seine eigene direkte ID sowie jeden direkt dargestellten Knoten darunter aus.'
    ,'Furniture → Furniture, Bookcases, Atlantic, Bush, Chairs, Hon': 'Möbel → Möbel, Bücherregale, Atlantic, Bush, Stühle, Hon'
    ,'Each checkbox controls only the ID attached directly to that node. Children stay independent.': 'Jedes Kontrollkästchen steuert nur die direkt diesem Knoten zugeordnete ID. Untergeordnete Einträge bleiben unabhängig.'
    ,'Furniture → Furniture': 'Möbel → Möbel'
    ,'The configured path separator is blank.': 'Das konfigurierte Pfadtrennzeichen ist leer.'
    ,'Row {row}: the ID is blank.': 'Zeile {row}: Die ID ist leer.'
    ,'Row {row}: every hierarchy label is blank.': 'Zeile {row}: Alle Hierarchiebeschriftungen sind leer.'
    ,'Row {row}: the hierarchy path is empty.': 'Zeile {row}: Der Hierarchiepfad ist leer.'
    ,'Row {row}: {field} is blank before a deeper level.': 'Zeile {row}: {field} ist vor einer tieferen Ebene leer.'
    ,'Row {row}: a deeper value follows the blank {field} field.': 'Zeile {row}: Auf das leere Feld {field} folgt ein Wert auf einer tieferen Ebene.'
    ,'Row {row}: a label contains the configured “{separator}” separator.': 'Zeile {row}: Eine Beschriftung enthält das konfigurierte Trennzeichen „{separator}“.'
    ,'ID “{id}” appears {count} times.': 'ID „{id}“ kommt {count}-mal vor.'
    ,'Child “{id}” references missing parent “{parent}”.': 'Untergeordneter Eintrag „{id}“ verweist auf den fehlenden übergeordneten Eintrag „{parent}“.'
    ,'Row {row}: the child ID is blank.': 'Zeile {row}: Die untergeordnete ID ist leer.'
    ,'Row {row} (ID “{id}”): the display label is blank.': 'Zeile {row} (ID „{id}“): Die Anzeigebeschriftung ist leer.'
    ,'Row {row}: the display label is blank.': 'Zeile {row}: Die Anzeigebeschriftung ist leer.'
    ,'Use the complete interface in English or German based on the Tableau or browser locale.': 'Die vollständige Oberfläche abhängig von der Tableau- oder Browsereinstellung auf Deutsch oder Englisch verwenden.'
    ,'A critical error was encountered:': 'Ein kritischer Fehler ist aufgetreten:'
    ,'Child ID ({field}) is no longer available.': 'Die untergeordnete ID ({field}) ist nicht mehr verfügbar.'
    ,'Child ID parameter is no longer available.': 'Der Parameter für die untergeordnete ID ist nicht mehr verfügbar.'
    ,'Child label ({field}) is no longer available.': 'Die untergeordnete Beschriftung ({field}) ist nicht mehr verfügbar.'
    ,'Child label parameter ({parameter}) is no longer available.': 'Der Parameter für die untergeordnete Beschriftung ({parameter}) ist nicht mehr verfügbar.'
    ,'Configuration could not be restored.': 'Die Konfiguration konnte nicht wiederhergestellt werden.'
    ,'Filter target ({target}) is no longer available.': 'Das Filterziel ({target}) ist nicht mehr verfügbar.'
    ,'ID field ({field}) is no longer available.': 'Das ID-Feld ({field}) ist nicht mehr verfügbar.'
    ,'One or more hierarchy fields have changed.': 'Ein oder mehrere Hierarchiefelder haben sich geändert.'
    ,'Parent ID ({field}) is no longer available.': 'Die übergeordnete ID ({field}) ist nicht mehr verfügbar.'
    ,'Please recheck your label parameter. It changed and was disabled.': 'Prüfen Sie den Beschriftungsparameter erneut. Er hat sich geändert und wurde deaktiviert.'
    ,'Please review the configuration options.': 'Prüfen Sie die Konfigurationsoptionen.'
    ,'The following settings changed.': 'Die folgenden Einstellungen haben sich geändert.'
    ,'Unable to initialize the configuration dialog:': 'Der Konfigurationsdialog konnte nicht initialisiert werden:'
};

const LocalizationContext=createContext<LocalizationContextValue>({
    locale: 'en',
    t: (message, values) => interpolate(message, values)
});

export function LocalizationProvider(props: { children: ReactNode, locale?: InterfaceLocale }) {
    const [locale, setLocale]=useState<InterfaceLocale>(() => props.locale||detectInterfaceLocale());
    const value=useMemo<LocalizationContextValue>(() => ({
        locale,
        t: (message, values) => translate(locale, message, values)
    }), [locale]);

    useEffect(() => {
        document.documentElement.lang=locale;
    }, [locale]);

    useEffect(() => {
        const refreshLocale=() => setLocale(props.locale||detectInterfaceLocale());
        window.addEventListener('hierarchy-locale-ready', refreshLocale);
        return () => window.removeEventListener('hierarchy-locale-ready', refreshLocale);
    }, [props.locale]);

    return <LocalizationContext.Provider value={value}>{props.children}</LocalizationContext.Provider>;
}

export function useTranslation(): LocalizationContextValue {
    return useContext(LocalizationContext);
}

export function LocalizedText(props: { message: string, values?: TranslationValues }) {
    const {t}=useTranslation();
    return <>{t(props.message, props.values)}</>;
}

/** Resolve German and English locales with a deterministic URL override for testing. */
export function resolveInterfaceLocale(
    tableauLocale?: string,
    browserLocale?: string,
    search=''
): InterfaceLocale {
    const override=new URLSearchParams(search).get('lang')?.toLocaleLowerCase();
    if(override==='de'||override==='en') { return override; }
    const locale=(tableauLocale||browserLocale||'en').toLocaleLowerCase();
    return locale==='de'||locale.startsWith('de-')?'de':'en';
}

export function translate(
    locale: InterfaceLocale,
    message: string,
    values?: TranslationValues
): string {
    const template=locale==='de'?(GERMAN_TRANSLATIONS[message]||message):message;
    return interpolate(template, values);
}

function detectInterfaceLocale(): InterfaceLocale {
    let tableauLocale: string|undefined;
    try {
        tableauLocale=(window as any).tableau?.extensions?.environment?.locale;
    }
    catch(_error) {
        tableauLocale=undefined;
    }
    return resolveInterfaceLocale(tableauLocale, window.navigator.language, window.location.search);
}

function interpolate(template: string, values?: TranslationValues): string {
    if(!values) { return template; }
    return Object.keys(values).reduce(
        (result, key) => result.replace(new RegExp(`\\{${ key }\\}`, 'g'), String(values[key])),
        template
    );
}
