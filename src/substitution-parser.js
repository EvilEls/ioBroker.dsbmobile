'use strict';

const cheerio = require('cheerio');

function cellText($, cell) {
    return $(cell).text().replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseClassCell(value) {
    if (!value) return [];
    return [...new Set(value.split(',')
        .map(className => className.trim())
        .filter(className => className && !/^[-–—]+$/.test(className)))];
}

/** Parse the ten-column replacement table observed in IHK DSBmobile HTML plans. */
function parseSubstitutionHtml(html, metadata = {}) {
    const $ = cheerio.load(html);
    const entries = [];

    $('tr').each((_, row) => {
        const cells = $(row).children('td').toArray();
        if (cells.length < 10 || $(cells[0]).hasClass('inline_header')) return;

        const values = cells.slice(0, 10).map(cell => cellText($, cell));
        const classes = [...new Set([
            ...parseClassCell(values[0]),
            ...parseClassCell(values[5]),
        ])];
        if (classes.length === 0) return;

        const change = {
            lesson: values[1],
            originalTeacher: values[2],
            originalSubject: values[3],
            originalRoom: values[4],
            replacementTeacher: values[6],
            replacementSubject: values[7],
            replacementRoom: values[8],
            note: values[9],
            planTitle: metadata.title || '',
            planDate: metadata.date || '',
            sourceUrl: metadata.url || '',
        };

        for (const className of classes) {
            entries.push({className, ...change});
        }
    });

    return entries;
}

module.exports = {parseSubstitutionHtml};
