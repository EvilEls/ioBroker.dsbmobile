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
