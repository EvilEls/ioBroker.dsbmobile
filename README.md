# ioBroker.dsbmobile

An ioBroker adapter for school news, timetable and substitution-plan data, and document metadata from DSBmobile.

The adapter authenticates with the configured credentials, polls DSBmobile data sources, and stores their results as JSON states in ioBroker. It also downloads substitution-plan HTML and parses entries for the configured classes.

> **Status:** Version 0.1.0 has been run successfully against a live DSBmobile account. The adapter connected and populated its data objects with school news, plan metadata, documents, and substitution entries. The data structure documented here reflects that implementation.

## Features

- DSBmobile authentication and retrieval of news, dashboard entries, timetables, and documents.
- Download and parsing of substitution-plan HTML in the observed ten-column format.
- Filtering of parsed substitution entries by one or more configured classes.
- Change detection using stable JSON snapshots.
- Configurable change events for substitution plans, news, documents, and timetables.
- Automatic creation of the required data channels and states at startup.
- Credentials are managed in the adapter settings; the password is marked as a protected and encrypted configuration value.

## Configuration

In the adapter settings:

1. Enter the DSBmobile username and password.
2. Add the classes to monitor, for example `7/5`. Add each class as a separate entry.
3. Set the polling interval in minutes (5 to 1440 minutes; default: 15).
4. Optionally choose which data categories should report changes through `events.lastChange`.

The configuration does not filter news, documents, or timetable items by class. Those are stored as source data. The class list filters parsed substitution entries.

## Automatically created object structure

The adapter creates its channels and states. JSON values are stored as JSON text in ioBroker states with the `json` role. Scripts and visualizations should parse the state value with `JSON.parse(state.val)`.

```text
dsbmobile.0
├── info
│   ├── connection                 # connection to DSBmobile
│   ├── lastCheck                  # last polling cycle
│   ├── lastError                  # source or polling errors
│   └── initialized                # first successful data load completed
├── substitutions
│   └── byClass                    # object: class name -> array of entries
├── timetables
│   └── items                      # raw entries from dsbtimetables
├── news
│   └── items                      # raw entries from newstab
├── documents
│   └── items                      # raw entries from dsbdocuments
└── events
    └── lastChange                 # most recently detected changes
```

### Substitution entries

`substitutions.byClass` contains a JSON object keyed by configured class names. Each class key maps to an array. An entry includes fields such as:

- `className`, `lesson`
- `originalTeacher`, `originalSubject`, `originalRoom`
- `replacementTeacher`, `replacementSubject`, `replacementRoom`
- `note`
- `planTitle`, `planDate`, `sourceUrl`

Entries are grouped by class. If a source row names multiple classes, it is added to each corresponding class. The adapter provides entries from the DSBmobile plans it finds. A visualization can select the plan that applies to a particular day and format the output, for example by removing duplicates or filtering messages.

### News, timetables, and documents

`news.items`, `timetables.items`, and `documents.items` store entries returned by their respective API endpoints. Document entries include metadata and references to child attachments. In version 0.1.0, image and PDF attachments are not stored as binary files in ioBroker. `timetables.items` contains source metadata; parsed substitution-plan HTML is also written to `substitutions.byClass`.

### Change events

On the first successful poll, the adapter stores a baseline and does not report a change. When it detects changes on later polls, it writes the affected categories to `events.lastChange`. The value remains `{}` until a change is detected.

Depending on the settings, changes can be reported for:

- `substitutions`
- `news`
- `documents`
- `timetables`

An event contains `category`, `changedAt`, and a snapshot hash. Substitution events also contain the monitored class keys.

If an individual endpoint temporarily fails, the adapter keeps its last successfully stored data for that source and records the error in `info.lastError`. Other successful sources continue to update. Authentication failures stop the polling cycle, set the connection state to `false`, and are logged without exposing credentials.

## API and parsing

The adapter currently uses:

- API host: `https://ihkapi.dsbcontrol.de`
- Authentication through `GET /authid` with the username, password, and portal parameters.
- Data endpoints: `/newstab`, `/starttab`, `/dsbtimetables`, and `/dsbdocuments`.
- Portal content: HTTPS files hosted on `www23content.dsbcontrol.de`.

The authentication ID is kept in memory only for the current polling cycle. HTML downloads are restricted to the content host above and to HTML files. Responses and credentials are not written to the logs.

The observed substitution plan uses ten table columns: original class, lesson, original teacher, original subject, original room, replacement class, replacement teacher, replacement subject, replacement room, and note. HTML without a charset declaration is decoded as Windows-1252.

## Implementation overview

- `main.js`: ioBroker initialization, object creation, polling, state updates, and change comparison.
- `src/ihk-client.js`: authentication, API requests, and restricted content downloads.
- `src/substitution-parser.js`: substitution-plan HTML parser.
- `src/data-model.js`: class-list normalization, grouping, and snapshot hashing.
- `admin/jsonConfig.json`: credentials, classes, polling interval, and change-event settings.

## Runtime requirements

The adapter metadata requires js-controller 6.0.11 or later and Admin 7.6.20 or later. The package requires Node.js 20.18.1 or later.

## Development

The adapter uses Node.js. Install dependencies with npm based on `package.json`. The repository contains no credentials or live portal responses. Parser changes should be checked against sanitized sample data before additional plan variants are documented as supported.
