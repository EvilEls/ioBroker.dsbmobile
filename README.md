# ioBroker.dsbmobile

ioBroker-Adapter für Schulnachrichten, Stundenpläne, Vertretungspläne und Dokumente aus DSBmobile.

> **Entwicklungsstand:** privater Prototyp. Adapter-Metadaten, Admin-Konfiguration und normalisiertes Datenmodell sind angelegt. Der authentifizierte DSBmobile-Web-API-Transport und die Parser für die einzelnen Datenquellen fehlen noch. Der aktuelle Adapter meldet deshalb bewusst keine erfolgreiche Verbindung.

## Ziele

- Anmeldung über die Webportal-API, die für das Zielportal getestet wurde.
- Schulweite Daten pro Abruf laden und Vertretungseinträge lokal für jede konfigurierte Klasse filtern.
- Vertretungspläne, reguläre Stundenpläne, Nachrichten und Dokumente in getrennten ioBroker-Bereichen ablegen.
- Neue, entfernte und geänderte Inhalte über stabile Snapshots erkennen, damit nachgelagerte ioBroker-Skripte gezielt Benachrichtigungen auslösen können.
- Den Adapter unabhängig von `@udondan/dsbmobile` entwickeln und die API-Schicht separat halten.

## Ergebnisse der ersten API-Untersuchung

Der manuelle Test des Zielportals konnte sich anmelden und folgende Quellen abrufen:

| Quelle | Beobachtetes Ergebnis |
| --- | --- |
| `authid` | Anmeldung lieferte eine Authentifizierungs-ID |
| `newstab` | 3 Nachrichten |
| `starttab` | 2 Dashboard-Einträge |
| `dsbtimetables` | 7 Plan- und Dokumenteinträge |
| `dsbdocuments` | 24 Dokumente; Anlagendaten liegen in untergeordneten Einträgen |
| Vertretungsplan-HTML | 2 Dateien geladen; Eintrag für `7/5` gefunden |

Der gefundene Eintrag für `7/5` enthielt Stunde, Fach, Lehrkraft, Raum und Hinweis. Beim HTML-Download muss die tatsächliche Zeichencodierung (vermutlich Windows-1252 oder ISO-8859-1) berücksichtigt werden; für die Auswertung ist ein HTML-Parser statt einer Textsuche nötig.

Vor Implementierung des HTTP-Transports müssen URL, HTTP-Methode, Anfrageparameter, Antwortbeispiele und Gültigkeit der Sitzung anhand bereinigter Test-Fixtures dokumentiert werden. Zugangsdaten, Authentifizierungs-IDs und schulbezogene Originaldaten gehören nicht ins Repository.

## Konfiguration

In den Adaptereinstellungen:

- DSBmobile-Benutzername und -Passwort eintragen. Das Passwort ist für ioBroker-Verschlüsselung und Zugriffsschutz vorgesehen.
- Eine oder mehrere Klassen eintragen, zum Beispiel `7/5` und `5/2`. Die Admin-Tabelle kann Zeilen hinzufügen, löschen und sortieren.
- Abrufintervall zwischen 5 und 1440 Minuten wählen.
- Festlegen, welche Änderungskategorien für nachgelagerte Benachrichtigungslogik gemeldet werden sollen.

## Geplante Objektstruktur

```text
dsbmobile.0
├── info
│   ├── connection
│   ├── lastCheck
│   └── lastError
├── substitutions
│   └── byClass                 # konfigurierte Klassen und ihre Einträge
├── timetables                  # reguläre Stunden- und andere Zeitpläne
├── news                        # allgemeine Schulnachrichten
├── documents                   # Dokumente und Anlagen
└── events                      # Änderungszusammenfassungen für Skripte
```

Der erste Stand legt nur die Adapter-Statusobjekte an. Die Datenbereiche kommen mit API-Transport und Parsern hinzu.

## Nächste Entwicklungsschritte

1. Bereinigte Anfrage- und Antwort-Fixtures für Anmeldung, `starttab`, `newstab`, `dsbtimetables`, `dsbdocuments` und den HTML-Download erfassen.
2. HTTP-/Sitzungsclient implementieren und Sitzungsablauf sowie Fehlerbehandlung abdecken.
3. Vertretungsplan-HTML mit passender Zeichencodierung parsen und Einträge allen konfigurierten Klassen zuordnen.
4. Stundenpläne, Nachrichten und Dokumente samt mehrseitigen Anlagen normalisieren.
5. ioBroker-States und Änderungsereignisse veröffentlichen.
6. Gezielte Tests anhand bereinigter Fixtures ergänzen und Installation sowie Konfiguration dokumentieren.

## Aktueller Implementierungsstand

- `main.js` startet den Adapter, normalisiert die Klassenkonfiguration und initialisiert Statuswerte.
- `src/data-model.js` bereinigt die Klassenliste, gruppiert geparste Einträge nach Klasse und berechnet deterministische SHA-256-Snapshot-Hashes.
- `admin/jsonConfig.json` definiert Konto, Abrufintervall, Mehrklassenkonfiguration und Änderungskategorien.
- `io-package.json` enthält Adapter-Metadaten und kennzeichnet das Passwort als verschlüsselt und geschützt.

API-Transport und Datenabruf sind noch nicht implementiert. Der Adapter weist darauf in `info.lastError` hin, statt einen irreführenden Verbindungsstatus anzuzeigen.
