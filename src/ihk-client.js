'use strict';

const axios = require('axios');
const {TextDecoder} = require('node:util');
const {parseSubstitutionHtml} = require('./substitution-parser');

const API_URL = 'https://ihkapi.dsbcontrol.de';
const CONTENT_HOSTS = new Set(['www23content.dsbcontrol.de']);
const PORTAL_CONFIG = {
    bundleid: 'de.heinekingmedia.ihkweb',
    pushid: 'pushtestid',
    appversion: '1000',
    osversion: '2334',
};

const http = axios.create({
    timeout: 30000,
    maxContentLength: 10 * 1024 * 1024,
    headers: {
        Accept: 'application/json, text/plain, */*',
        Origin: 'https://ihk.dsbmobile.de',
        Referer: 'https://ihk.dsbmobile.de/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/156.0.0.0 Safari/537.36',
    },
});

function extractAuthId(auth) {
    if (typeof auth === 'string') return auth.trim().replace(/^"|"$/g, '');
    return auth?.authid ?? auth?.AuthId ?? '';
}

function findUrls(value, urls = []) {
    if (typeof value === 'string' && /^https?:\/\//i.test(value)) {
        urls.push(value);
    } else if (Array.isArray(value)) {
        for (const item of value) findUrls(item, urls);
    } else if (value && typeof value === 'object') {
        for (const item of Object.values(value)) findUrls(item, urls);
    }
    return [...new Set(urls)];
}

function allowedHtmlUrl(rawUrl) {
    try {
        const url = new URL(rawUrl);
        return url.protocol === 'https:' && CONTENT_HOSTS.has(url.hostname.toLowerCase()) && /\.html?$/i.test(url.pathname);
    } catch {
        return false;
    }
}

function planResources(...sources) {
    const seen = new Set();
    const resources = [];
    for (const source of sources) {
        if (!Array.isArray(source)) continue;
        for (const item of source) {
            for (const url of findUrls(item)) {
                if (!allowedHtmlUrl(url) || seen.has(url)) continue;
                seen.add(url);
                resources.push({
                    url,
                    title: typeof item?.Title === 'string' ? item.Title : '',
                    date: typeof item?.Date === 'string' ? item.Date : '',
                });
            }
        }
    }
    return resources;
}

function decodeHtml(bytes, contentType = '') {
    const match = /charset\s*=\s*["']?([^;"'\s]+)/i.exec(contentType);
    const charset = match?.[1] || 'windows-1252';
    try {
        return new TextDecoder(charset).decode(bytes);
    } catch {
        return new TextDecoder('windows-1252').decode(bytes);
    }
}

function safeEndpointError(endpoint, error) {
    const status = error?.response?.status;
    if (status) return `${endpoint}: HTTP ${status}`;
    if (error?.code === 'ECONNABORTED') return `${endpoint}: request timed out`;
    return `${endpoint}: network or response error`;
}

class IhkClient {
    async apiGet(endpoint, params = {}) {
        const response = await http.get(`${API_URL}/${endpoint}`, {params});
        return response.data;
    }

    async downloadPlan(resource) {
        const response = await http.get(resource.url, {responseType: 'arraybuffer'});
        const html = decodeHtml(response.data, response.headers['content-type']);
        return parseSubstitutionHtml(html, resource);
    }

    async fetchSnapshot(username, password) {
        const auth = await this.apiGet('authid', {
            user: username,
            password,
            ...PORTAL_CONFIG,
        });
        const authid = extractAuthId(auth);
        if (!authid) throw new Error('Authentication endpoint returned no auth ID.');

        const endpoints = ['newstab', 'starttab', 'dsbtimetables', 'dsbdocuments'];
        const responses = await Promise.allSettled(endpoints.map(endpoint => this.apiGet(endpoint, {authid})));
        const data = {};
        const errors = [];
        responses.forEach((result, index) => {
            const endpoint = endpoints[index];
            if (result.status !== 'fulfilled') {
                errors.push(safeEndpointError(endpoint, result.reason));
            } else if (!Array.isArray(result.value)) {
                errors.push(`${endpoint}: unexpected response format`);
            } else {
                data[endpoint] = result.value;
            }
        });

        const resources = planResources(data.starttab, data.dsbtimetables);
        const downloadedPlans = await Promise.allSettled(resources.map(resource => this.downloadPlan(resource)));
        const substitutions = [];
        let successfulPlanDownloads = 0;
        downloadedPlans.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                successfulPlanDownloads++;
                substitutions.push(...result.value);
            }
            else errors.push(safeEndpointError('substitution HTML download', result.reason));
        });

        return {
            successfulEndpoints: Object.keys(data).length,
            news: data.newstab === undefined ? undefined : (Array.isArray(data.newstab) ? data.newstab : []),
            starttab: data.starttab === undefined ? undefined : (Array.isArray(data.starttab) ? data.starttab : []),
            timetables: data.dsbtimetables === undefined ? undefined : (Array.isArray(data.dsbtimetables) ? data.dsbtimetables : []),
            documents: data.dsbdocuments === undefined ? undefined : (Array.isArray(data.dsbdocuments) ? data.dsbdocuments : []),
            substitutions: downloadedPlans.some(result => result.status === 'rejected') ||
                (data.starttab === undefined || data.dsbtimetables === undefined) ||
                (resources.length > 0 && successfulPlanDownloads === 0) ? undefined : substitutions,
            errors,
        };
    }
}

module.exports = {IhkClient, safeEndpointError};
