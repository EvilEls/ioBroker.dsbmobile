# ioBroker.dsbmobile

ioBroker-Adapter für Schulnachrichten, Stunden- und Vertretungspläne sowie Dokumentmetadaten aus DSBmobile.

Der Adapter meldet sich mit den konfigurierten Zugangsdaten an, ruft die DSBmobile-Datenquellen regelmäßig ab und legt die Ergebnisse als JSON-States in ioBroker ab. Vertretungsplan-HTML wird zusätzlich geladen und für die konfigurierten Klassen geparst.

> **Status:** Version 0.1.0 wurde live mit einem DSBmobile-Konto betrieben. Der Adapter hat sich erfolgreich verbunden und die Datenobjekte mit Schulnachrichten, Planmetadaten, Dokumenten und Vertretungseinträgen befüllt. Die hier dokumentierte Datenstruktur entspricht diesem Stand.

## Funktionen

- DSBmobile-Anmeldung und Abruf von Nachrichten, Dashboard-Einträgen, Stunden-/Zeitplänen und Dokumenten.
- Download und Parsing von Vertretungsplan-HTML im beobachteten Zehn-Spalten-Format.
- Filterung der Vertretungseinträge nach einer oder mehreren konfigurierten Klassen.
- Erkennung von Änderungen anhand stabiler JSON-Snapshots.
- Einstellbare Änderungsereignisse für Vertretungspläne, Nachrichten, Dokumente und Stundenpläne.
- Erzeugung der benötigten Datenkanäle und States beim Start.
- Zugangsdaten werden in den Adaptereinstellungen verwaltet; das Passwort ist als geschützter und verschlüsselter Konfigurationswert markiert.

## Einrichtung

In den Adaptereinstellungen:

1. DSBmobile-Benutzername und Passwort eintragen.
2. Die zu überwachenden Klassen ergänzen, zum Beispiel `7/5`. Mehrere Klassen können als getrennte Einträge eingetragen werden.
3. Das Abrufintervall in Minuten festlegen (5 bis 1440 Minuten, Standard: 15).
4. Optional auswählen, für welche Datenkategorien Änderungen in `events.lastChange` gemeldet werden sollen.

Die Konfiguration enthält keine Klassenfilter für Nachrichten, Dokumente oder Stundenpläne. Diese Inhalte werden als Quelldaten abgelegt. Die Klassenliste filtert die geparsten Vertretungseinträge.

## Automatisch angelegte Objektstruktur

Der Adapter erzeugt die Kanäle und States selbst. Die JSON-Inhalte werden jeweils als JSON-Text in einem ioBroker-State mit Rolle `json` gespeichert; in Skripten oder Visualisierungen muss der Statewert daher mit `JSON.parse(state.val)` geparst werden.

```text
dsbmobile.0
├── info
│   ├── connection                 # Verbindung zum DSBmobile-Dienst
│   ├── lastCheck                  # Zeitpunkt des letzten Abrufzyklus
│   ├── lastError                  # Fehler einzelner Quellen oder des Abrufs
│   └── initialized                # erster erfolgreicher Datenabruf abgeschlossen
├── substitutions
│   └── byClass                    # Objekt: Klassenname -> Array von Einträgen
├── timetables
│   └── items                      # rohe Einträge aus dsbtimetables
├── news
│   └── items                      # rohe Einträge aus newstab
├── documents
│   └── items                      # rohe Einträge aus dsbdocuments
└── events
    └── lastChange                 # zuletzt erkannte Änderungen
```

### Vertretungseinträge

`substitutions.byClass` enthält ein JSON-Objekt, dessen Schlüssel die konfigurierten Klassennamen sind. Jeder Klassenschlüssel enthält ein Array. Ein Eintrag hat unter anderem diese Felder:

- `className`, `lesson`
- `originalTeacher`, `originalSubject`, `originalRoom`
- `replacementTeacher`, `replacementSubject`, `replacementRoom`
- `note`
- `planTitle`, `planDate`, `sourceUrl`

Die Einträge sind nach Klasse gruppiert. Mehrere in der Quelle genannte Klassen werden jeweils als eigener Klasseneintrag abgelegt. Der Adapter liefert Planstände aus den gefundenen DSBmobile-Quellen; die Auswahl des für einen bestimmten Tag gültigen Plans und die Darstellung (zum Beispiel Deduplizierung oder Nachrichtenfilter) kann die Visualisierung übernehmen.

### Nachrichten, Pläne und Dokumente

`news.items`, `timetables.items` und `documents.items` speichern die vom API-Endpunkt gelieferten Einträge. Dokumente enthalten Metadaten und Verweise auf untergeordnete Anlagen. Bild- oder PDF-Anlagen werden in Version 0.1.0 nicht als Binärdatei in ioBroker gespeichert. `timetables.items` enthält Quellmetadaten; Vertretungsplan-HTML wird zusätzlich nach `substitutions.byClass` geparst.

### Änderungsereignisse

Beim ersten erfolgreichen Abruf speichert der Adapter den Ausgangsstand und löst keine Änderungsmeldung aus. Bei später erkannten Änderungen schreibt er die betroffenen Kategorien nach `events.lastChange`. Ist noch keine Änderung erkannt worden, bleibt der Wert `{}`.

Je nach Einstellung können Änderungen in diesen Kategorien gemeldet werden:

- `substitutions`
- `news`
- `documents`
- `timetables`

Ein Ereigniseintrag enthält `category`, `changedAt` und den Snapshot-Hash; bei Vertretungsplänen zusätzlich die überwachten Klassenschlüssel.

Wenn ein einzelner Endpunkt vorübergehend fehlschlägt, behält der Adapter dessen zuletzt erfolgreich gespeicherte Daten bei und trägt den Fehler in `info.lastError` ein. Erfolgreiche Quellen werden trotzdem aktualisiert. Authentifizierungsfehler beenden den Abrufzyklus, setzen die Verbindung auf `false` und werden ohne Zugangsdaten im Fehlertext protokolliert.

## API und Parsing

Der Adapter verwendet derzeit:

- API-Host: `https://ihkapi.dsbcontrol.de`
- Anmeldung über `GET /authid` mit Benutzername, Passwort und Portalparametern.
- Datenendpunkte: `/newstab`, `/starttab`, `/dsbtimetables` und `/dsbdocuments`.
- Portalinhalt: HTTPS-Dateien vom Host `www23content.dsbcontrol.de`.

Die Auth-ID wird nur für den jeweiligen Abrufzyklus im Arbeitsspeicher gehalten. HTML-Downloads sind auf den genannten Content-Host und HTML-Dateien beschränkt. Antworten und Zugangsdaten werden nicht in Logs ausgegeben.

Der beobachtete Vertretungsplan verwendet zehn Tabellenspalten: bisherige Klasse, Stunde, bisherige Lehrkraft, bisheriges Fach, bisheriger Raum, neue Klasse, neue Lehrkraft, neues Fach, neuer Raum und Hinweis. HTML ohne Charset-Angabe wird als Windows-1252 dekodiert.

## Implementierungsübersicht

- `main.js`: ioBroker-Initialisierung, Objekterzeugung, Polling, State-Aktualisierung und Änderungsvergleich.
- `src/ihk-client.js`: Authentifizierung, API-Abrufe und begrenzte Content-Downloads.
- `src/substitution-parser.js`: Parser für Vertretungsplan-HTML.
- `src/data-model.js`: Normalisierung der Klassenliste, Gruppierung und Snapshot-Hashing.
- `admin/jsonConfig.json`: Zugangsdaten, Klassen, Abrufintervall und Ereigniskategorien.

## Laufzeitvoraussetzungen

Laut Adapter-Metadaten werden js-controller ab 6.0.11 und Admin ab 7.6.20 benötigt. Das Paket verlangt Node.js ab 20.18.1.

## Entwicklung

Der Adapter verwendet Node.js. Abhängigkeiten werden über npm aus `package.json` installiert. Es gibt keine Zugangsdaten oder Live-Portalantworten im Repository. Änderungen am Parser sollten mit bereinigten Beispieldaten geprüft werden, bevor weitere Planvarianten als unterstützt dokumentiert werden.
