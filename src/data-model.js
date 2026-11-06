'use strict';

const { createHash } = require('node:crypto');

function normalizeClasses(configuredClasses) {
    if (!Array.isArray(configuredClasses)) return [];

    const seen = new Set();
    const classes = [];
    for (const row of configuredClasses) {
        const value = typeof row === 'string' ? row : row?.className;
        if (typeof value !== 'string') continue;
        const className = value.trim();
        const key = className.toLocaleLowerCase();
        if (className && !seen.has(key)) {
            seen.add(key);
            classes.push(className);
        }
    }
    return classes;
}

function getEntryClass(entry) {
    const value = entry?.className ?? entry?.class ?? entry?.klasse;
    return typeof value === 'string' ? value.trim() : '';
}

function groupEntriesByClass(entries, configuredClasses) {
    const groups = Object.fromEntries(normalizeClasses(configuredClasses).map(className => [className, []]));
    if (!Array.isArray(entries)) return groups;

    const namesByLowerCase = new Map(Object.keys(groups).map(className => [className.toLocaleLowerCase(), className]));
    for (const entry of entries) {
        const configuredName = namesByLowerCase.get(getEntryClass(entry).toLocaleLowerCase());
        if (configuredName) groups[configuredName].push(entry);
    }
    return groups;
}

function canonicalize(value) {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
    }
    return value;
}

function snapshotHash(value) {
    return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

module.exports = {normalizeClasses, groupEntriesByClass, snapshotHash};
