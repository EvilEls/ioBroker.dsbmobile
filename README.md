# ioBroker.dsbmobile

ioBroker-Adapter für Schulnachrichten, Stundenpläne, Vertretungspläne und Dokumente aus DSBmobile.

> **Entwicklungsstand:** privater Prototyp. Der Adapter enthält den authentifizierten Web-API-Client, einen Parser für das beobachtete Vertretungsplanformat, den Mehrklassenfilter und die initiale ioBroker-State-Struktur. Live-Abrufe aus dem Adapter und die Normalisierung aller Metadatenfelder müssen noch bestätigt werden.

## Ziele

- Schulweite Daten pro Abruf laden und Vertretungseinträge lokal für jede konfigurierte Klasse filtern.
- Vertretungspläne, reguläre Stundenpläne, Nachrichten und Dokumente getrennt in ioBroker ablegen.
- Neue, entfernte und geänderte Inhalte über stabile Snapshots erkennen, damit ioBroker-Skripte gezielt Benachrichtigungen auslösen können.
- Den Adapter unabhängig von `@udondan/dsbmobile` entwickeln und die API-Schicht separat halten.

## Bestätigtes API-Protokoll

Der manuelle Test des Zielportals konnte sich anmelden und folgende Quellen abrufen:

| Quelle | Beobachtetes Ergebnis |
| --- | --- |
| `authid` | Anmeldung lieferte eine Authentifizierungs-ID |
| `newstab` | 3 Nachrichten |
| `starttab` | 2 Dashboard-Einträge |
| `dsbtimetables` | 7 Plan- und Dokumenteinträge |
| `dsbdocuments` | 24 Dokumente; Anlagen liegen in untergeordneten Einträgen |
| Vertretungsplan-HTML | 2 Dateien geladen; Eintrag für `7/5` gefunden |

Die Request-Details aus dem erfolgreichen Test:

- API: `https://ihkapi.dsbcontrol.de`
- Anmeldung: `GET /authid` mit Query-Parametern `user`, `password`, `bundleid`, `pushid`, `appversion` und `osversion`.
- Im erfolgreichen Test verwendete Portalparameter: `bundleid=de.heinekingmedia.ihkweb`, `pushid=pushtestid`, `appversion=1000`, `osversion=2334`.
- Daten: `GET /newstab`, `/starttab`, `/dsbtimetables` und `/dsbdocuments`, jeweils mit `authid` als Query-Parameter.
- Portal-Header: `Origin: https://ihk.dsbmobile.de` und passender `Referer`.
- Anlagen und Pläne: HTTPS-Links vom Host `www23content.dsbcontrol.de`.
- HTML-Pläne: als Bytes laden und mit der angegebenen Zeichencodierung decodieren; ohne Charset-Angabe Windows-1252 verwenden.

Die Auth-ID bleibt nur während eines Abrufzyklus im Arbeitsspeicher. Zugangsdaten, Auth-IDs und schulbezogene Content-URLs werden nicht in den Quellcode übernommen oder protokolliert. Die vollständigen JSON-Antworten und die Lebensdauer der Auth-ID waren nicht Teil der eingefügten Testausgabe; diese Details müssen noch anhand bereinigter Fixtures bestätigt werden.

Der beobachtete Vertretungsplan enthält Tabellenzeilen mit zehn Zellen: Klasse, Stunde, bisherige Lehrkraft, bisheriges Fach, bisheriger Raum, neue Klasse, neue Lehrkraft, neues Fach, neuer Raum und Hinweis. Mehrere Klassen in einer Zelle werden einzeln aufgelöst.

## Konfiguration

In den Adaptereinstellungen:

- DSBmobile-Benutzername und -Passwort eintragen. Das Passwort ist für ioBroker-Verschlüsselung und Zugriffsschutz vorgesehen.
- Eine oder mehrere Klassen eintragen, zum Beispiel `7/5` und `5/2`. Die Admin-Tabelle unterstützt Hinzufügen, Löschen und Sortieren.
- Abrufintervall zwischen 5 und 1440 Minuten wählen.
- Festlegen, für welche Kategorien Änderungseinträge erstellt werden sollen.

## Objektstruktur

```text
dsbmobile.0
├── info
│   ├── connection
│   ├── lastCheck
│   ├── lastError
│   └── initialized
├── substitutions.byClass       # Vertretungseinträge nach konfigurierter Klasse
├── timetables.items             # rohe Stunden- und Zeitplaneinträge
├── news.items                   # rohe Nachrichten
├── documents.items              # Dokumente und Anlagenmetadaten
└── events.lastChange            # zuletzt erkannte Änderungen
```

API-Fehler einer einzelnen Quelle überschreiben deren zuletzt erfolgreiche Daten nicht. Der Fehler erscheint in `info.lastError`; erfolgreiche Quellen werden weiterhin aktualisiert. Die erste erfolgreiche Abfrage bildet den Ausgangsstand und löst keine Benachrichtigung aus.

## Implementierungsstand

- `main.js` initialisiert die Datenkanäle, ruft die API direkt und anschließend alle konfigurierten Minuten ab, aktualisiert JSON-States und erkennt Änderungen über Snapshots.
- `src/ihk-client.js` implementiert Authentifizierung, die vier GET-Datenquellen und sichere Downloads der erlaubten HTML-Content-URLs.
- `src/substitution-parser.js` parst das beobachtete Zehn-Spalten-Tabellenformat und ordnet Zeilen den Klassen zu.
- `src/data-model.js` bereinigt die Klassenliste, gruppiert Einträge nach Klasse und berechnet deterministische SHA-256-Snapshot-Hashes.
- `admin/jsonConfig.json` definiert Konto, Abrufintervall, Mehrklassenkonfiguration und Änderungskategorien.
- `io-package.json` deklariert die Adapter-Metadaten und schützt das Passwort.

## Nächste Schritte

1. Den Adapter mit den realen Zugangsdaten gegen das Portal laufen lassen und Auth-ID-Lebensdauer sowie Antwortformate bestätigen.
2. Bereinigte JSON-Fixtures verwenden, um Nachrichten, Zeitpläne und Dokumentanlagen in stabile, dokumentierte Datenmodelle zu überführen.
3. Weitere HTML-Varianten prüfen und Parserfälle ergänzen.
4. Gezielte Tests für API-Antworten, Parsing und Änderungslogik ergänzen.
