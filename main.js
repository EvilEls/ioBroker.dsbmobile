'use strict';

const utils = require('@iobroker/adapter-core');
const {IhkClient, safeEndpointError} = require('./src/ihk-client');
const {groupEntriesByClass, normalizeClasses, snapshotHash} = require('./src/data-model');

class Dsbmobile extends utils.Adapter {
    constructor(options = {}) {
        super({...options, name: 'dsbmobile'});
        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));
        this.pollTimer = null;
        this.stopping = false;
        this.isPolling = false;
        this.client = new IhkClient();
    }

    async onReady() {
        await this.createDataObjects();
        await this.setStateAsync('info.connection', false, true);
        await this.setStateAsync('info.lastCheck', '', true);
        await this.setStateAsync('info.lastError', '', true);

        const classes = normalizeClasses(this.config.classes);
        if (!this.config.username || !this.config.password) {
            await this.setStateAsync('info.lastError', 'DSBmobile username and password are required.', true);
            this.log.warn('Configure the DSBmobile username and password in the instance settings.');
            return;
        }
        if (classes.length === 0) this.log.warn('No classes are configured. Add at least one class in the instance settings.');

        await this.poll();
    }

    async createDataObjects() {
        const channels = [
            ['substitutions', 'Vertretungspläne'],
            ['timetables', 'Stunden- und Zeitpläne'],
            ['news', 'Schulnachrichten'],
            ['documents', 'Dokumente'],
            ['events', 'Änderungen'],
        ];
        for (const [id, name] of channels) {
            await this.setObjectNotExistsAsync(id, {
                type: 'channel',
                common: {name},
                native: {},
            });
        }

        await this.createJsonState('substitutions.byClass', 'Vertretungseinträge nach Klasse', {});
        await this.createJsonState('timetables.items', 'Stunden- und Zeitpläne', []);
        await this.createJsonState('news.items', 'Schulnachrichten', []);
        await this.createJsonState('documents.items', 'Dokumente und Anlagen', []);
        await this.createJsonState('events.lastChange', 'Letzte erkannte Änderung', {});
        await this.setObjectNotExistsAsync('info.initialized', {
            type: 'state',
            common: {name: 'Initial data load completed', type: 'boolean', role: 'indicator', read: true, write: false, def: false},
            native: {},
        });
        if (!(await this.getStateAsync('info.initialized'))) {
            await this.setStateAsync('info.initialized', false, true);
        }
    }

    async createJsonState(id, name, initialValue) {
        await this.setObjectNotExistsAsync(id, {
            type: 'state',
            common: {
                name,
                type: 'string',
                role: 'json',
                read: true,
                write: false,
                def: JSON.stringify(initialValue),
            },
            native: {},
        });

        if (!(await this.getStateAsync(id))) {
            await this.setStateAsync(id, JSON.stringify(initialValue), true);
        }
    }

    async poll() {
        if (this.isPolling || this.stopping) return;
        this.isPolling = true;

        try {
            const snapshot = await this.client.fetchSnapshot(this.config.username, this.config.password);
            await this.setStateAsync('info.connection', true, true);
            await this.publishSnapshot(snapshot);
            await this.setStateAsync('info.lastCheck', new Date().toISOString(), true);
            await this.setStateAsync('info.lastError', snapshot.errors.join('\n'), true);
            if (snapshot.errors.length) this.log.warn(`Some DSBmobile data could not be read: ${snapshot.errors.join('; ')}`);
            else this.log.info('DSBmobile data updated.');
        } catch (error) {
            const message = safeEndpointError('DSBmobile', error);
            await this.setStateAsync('info.connection', false, true);
            await this.setStateAsync('info.lastError', message, true);
            this.log.warn(message);
        } finally {
            this.isPolling = false;
            this.scheduleNextPoll();
        }
    }

    async publishSnapshot(snapshot) {
        const classes = this.config.classes;
        const categories = [
            {id: 'substitutions.byClass', name: 'substitutions', value: snapshot.substitutions === undefined ? undefined : groupEntriesByClass(snapshot.substitutions, classes), enabled: this.config.notifySubstitutions !== false},
            {id: 'news.items', name: 'news', value: snapshot.news, enabled: this.config.notifyNews === true},
            {id: 'timetables.items', name: 'timetables', value: snapshot.timetables, enabled: this.config.notifyTimetables === true},
            {id: 'documents.items', name: 'documents', value: snapshot.documents, enabled: this.config.notifyDocuments === true},
        ];
        const initialized = (await this.getStateAsync('info.initialized'))?.val === true;
        const changes = [];

        for (const category of categories) {
            if (category.value === undefined) continue;
            const oldState = await this.getStateAsync(category.id);
            const previous = this.parseJsonState(oldState?.val);
            const changed = initialized && previous !== undefined && snapshotHash(previous) !== snapshotHash(category.value);
            await this.setStateAsync(category.id, JSON.stringify(category.value), true);

            if (changed && category.enabled) {
                changes.push({
                    category: category.name,
                    changedAt: new Date().toISOString(),
                    hash: snapshotHash(category.value),
                    classes: category.name === 'substitutions' ? Object.keys(category.value) : undefined,
                });
            }
        }

        if (changes.length) {
            await this.setStateAsync('events.lastChange', JSON.stringify(changes), true);
        }
        if (snapshot.successfulEndpoints > 0) {
            await this.setStateAsync('info.initialized', true, true);
        }
    }

    parseJsonState(value) {
        if (typeof value !== 'string') return undefined;
        try {
            return JSON.parse(value);
        } catch {
            return undefined;
        }
    }

    scheduleNextPoll() {
        if (this.stopping || this.pollTimer) return;
        const minutes = Math.max(5, Math.min(1440, Number(this.config.pollIntervalMinutes) || 15));
        this.pollTimer = this.setTimeout(() => {
            this.pollTimer = null;
            void this.poll();
        }, minutes * 60 * 1000);
    }

    onUnload(callback) {
        this.stopping = true;
        if (this.pollTimer) {
            this.clearTimeout(this.pollTimer);
            this.pollTimer = null;
        }
        callback();
    }
}

if (module.parent) module.exports = options => new Dsbmobile(options);
else new Dsbmobile();
