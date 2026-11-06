'use strict';

const utils = require('@iobroker/adapter-core');
const {normalizeClasses} = require('./src/data-model');

class Dsbmobile extends utils.Adapter {
    constructor(options = {}) {
        super({...options, name: 'dsbmobile'});
        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));
        this.pollTimer = null;
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

        // The DSBmobile web API transport is added in the next implementation step.
        // Do not report a connection until an authenticated request succeeds.
        await this.setStateAsync('info.lastError', 'DSBmobile API transport is not implemented yet.', true);
        this.log.info(`Configuration loaded for ${classes.length} class(es); API transport is not implemented yet.`);
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

    onUnload(callback) {
        if (this.pollTimer) {
            this.clearTimeout(this.pollTimer);
            this.pollTimer = null;
        }
        callback();
    }
}

if (module.parent) module.exports = options => new Dsbmobile(options);
else new Dsbmobile();
