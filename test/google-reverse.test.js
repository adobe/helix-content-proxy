/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/* eslint-env mocha */
/* eslint-disable no-param-reassign */

process.env.HELIX_FETCH_FORCE_HTTP1 = 'true';

const assert = require('assert');
const z = require('zlib');
const { main } = require('../src/index.js');
const cache = require('../src/cache.js');

const { setupPolly } = require('./utils.js');

// require('dotenv').config();

const fstab = `
mountpoints:
  /ms: https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/theblog
  /gdocs: "https://drive.google.com/drive/folders/1snjgJoqKO71T--uLIAsindAl82FuOtrR"
  /google-home.md: gdrive:1GIItS1y0YXTySslLGqJZUFxwFH1DPlSg3R7ybYY3ATE
`;

const fstab2 = `
mountpoints:
  /: https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/theblog
`;

const DEFAULT_PARAMS = {
  owner: 'adobe',
  repo: 'theblog',
  ref: 'master',
  path: '/',
  GOOGLE_DOCS2MD_CLIENT_ID: process.env.GOOGLE_DOCS2MD_CLIENT_ID || 'fake',
  GOOGLE_DOCS2MD_CLIENT_SECRET: process.env.GOOGLE_DOCS2MD_CLIENT_SECRET || 'fake',
  GOOGLE_DOCS2MD_REFRESH_TOKEN: process.env.GOOGLE_DOCS2MD_REFRESH_TOKEN || 'fake',
};

function scramble(server) {
  server.any().on('beforePersist', (_, recording) => {
    recording.request.headers = recording.request.headers.filter(({ name }) => name !== 'authorization');
    delete recording.request.postData;

    if (recording.request.url === 'https://oauth2.googleapis.com/token') {
      const val = JSON.parse(z.gunzipSync(Buffer.from(JSON.parse(recording.response.content.text).join(''), 'hex')));
      val.access_token = val.access_token
        .replace(/[A-Z]/g, 'A')
        .replace(/[0-9]/g, '0')
        .replace(/[a-z]/g, 'a');

      const buf = JSON.stringify([z.gzipSync(Buffer.from(JSON.stringify(val), 'utf8')).toString('hex')]);
      recording.response.content.text = buf;
    }
  });
}

describe('Google Reverse Lookup Tests', () => {
  before(() => {
    // clear cache for tests
    cache.options({ maxSize: 1000 });
  });

  setupPolly({
    recordIfMissing: false,
    matchRequestsBy: {
      method: true,
      headers: false,
      body: false,
      order: false,
      url: {
        protocol: true,
        username: false,
        password: false,
        hostname: true,
        port: false,
        pathname: true,
        query: true,
        hash: true,
      },
    },
  });

  it('Returns redirect for google document', async function googleSheet() {
    const { server } = this.polly;
    scramble(server);

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      ...DEFAULT_PARAMS,
      lookup: 'https://docs.google.com/document/d/1nbKakMrvDhf032da2hEYuxU30cdUmyZPv1kuRCKXiho/edit',
    });

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://theblog--adobe.hlx.page/gdocs/helix-hackathon-part-v.html');
  }).timeout(50000);

  it('Returns redirect for google document (main branch)', async function googleSheet() {
    const { server } = this.polly;
    scramble(server);

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/main/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      ...DEFAULT_PARAMS,
      ref: 'main',
      lookup: 'https://docs.google.com/document/d/1nbKakMrvDhf032da2hEYuxU30cdUmyZPv1kuRCKXiho/edit',
    });

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://theblog--adobe.hlx.page/gdocs/helix-hackathon-part-v.html');
  }).timeout(50000);

  it('Returns redirect for google document (non default branch)', async function googleSheet() {
    const { server } = this.polly;
    scramble(server);

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/stage/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      ...DEFAULT_PARAMS,
      ref: 'stage',
      lookup: 'https://docs.google.com/document/d/1nbKakMrvDhf032da2hEYuxU30cdUmyZPv1kuRCKXiho/edit',
    });

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://stage--theblog--adobe.hlx.page/gdocs/helix-hackathon-part-v.html');
  }).timeout(50000);

  it('Returns redirect for google document (custom prefix)', async function googleSheet() {
    const { server } = this.polly;
    scramble(server);

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      ...DEFAULT_PARAMS,
      prefix: 'https://blog.adobe.com',
      lookup: 'https://docs.google.com/document/d/1nbKakMrvDhf032da2hEYuxU30cdUmyZPv1kuRCKXiho/edit',
    });

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://blog.adobe.com/gdocs/helix-hackathon-part-v.html');
  }).timeout(50000);

  it('Returns 404 for google document (no matching mountpoint)', async function googleSheet() {
    const { server } = this.polly;
    scramble(server);

    server
      .get('https://raw.githubusercontent.com/adobe/another/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab2));

    const result = await main({
      ...DEFAULT_PARAMS,
      repo: 'another',
      lookup: 'https://docs.google.com/document/d/1nbKakMrvDhf032da2hEYuxU30cdUmyZPv1kuRCKXiho/edit',
    });

    assert.equal(result.statusCode, 404);
  }).timeout(50000);

  it('Returns 404 for google document (no fstab)', async function googleSheet() {
    const { server } = this.polly;
    scramble(server);

    server
      .get('https://raw.githubusercontent.com/adobe/nonpages/master/fstab.yaml')
      .intercept((_, res) => res.status(404));

    const result = await main({
      ...DEFAULT_PARAMS,
      repo: 'nonpages',
      lookup: 'https://docs.google.com/document/d/1nbKakMrvDhf032da2hEYuxU30cdUmyZPv1kuRCKXiho/edit',
    });

    assert.equal(result.statusCode, 404);
  }).timeout(50000);

  it('Returns redirect for google sheet', async function googleSheet() {
    const { server } = this.polly;
    scramble(server);

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      ...DEFAULT_PARAMS,
      lookup: 'https://docs.google.com/spreadsheets/d/1IDFZH5HVoYIg9siz1rK7d3hqAOeUpVc4WsgCdf2IMyA/view',
    });

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://theblog--adobe.hlx.page/gdocs/country-codes.json');
  }).timeout(50000);

  it('Returns redirect for google document (gdrive uri)', async function googleSheet() {
    const { server } = this.polly;
    scramble(server);

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      ...DEFAULT_PARAMS,
      lookup: 'gdrive:1nbKakMrvDhf032da2hEYuxU30cdUmyZPv1kuRCKXiho',
    });

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://theblog--adobe.hlx.page/gdocs/helix-hackathon-part-v.html');
  }).timeout(50000);
});
