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
const { main: universalMain } = require('../src/index.js');
const { setupPolly, retrofit } = require('./utils.js');
const cache = require('../src/cache.js');

// require('dotenv').config();
const main = retrofit(universalMain);

const fstab = `
mountpoints:
  /ms: https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/theblog
  /g: https://drive.google.com/drive/u/0/folders/1bH7_28a1-Q3QEEvFhT9eTmR-D7_9F4xP
  /google-home.md: gdrive:1GIItS1y0YXTySslLGqJZUFxwFH1DPlSg3R7ybYY3ATE
`;

describe('Google Integration Tests', () => {
  before(() => {
    // clear cache for tests
    cache.options({ maxSize: 1000 });
  });

  setupPolly({
    recordIfMissing: false,
  });

  it('Retrieves Document from Google Docs', async function okGoogle() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'master',
      path: '/g/nothing.md',
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body, '# This is nothing\n\n...yet\n');
    assert.equal(result.headers['x-source-location'], '1GIItS1y0YXTySslLGqJZUFxwFH1DPlSg3R7ybYY3ATE');
    assert.equal(result.headers['surrogate-control'], 'max-age=30758400, stale-while-revalidate=30758400, stale-if-error=30758400, immutable');
    assert.equal(result.headers.vary, 'x-ow-version-lock');
  }).timeout(5000);

  it('Retrieves Document mounted md from Google Docs', async function okGoogle() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'master',
      path: '/google-home.md',
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body, '# This is nothing\n\n...yet\n');
    assert.equal(result.headers['x-source-location'], '1GIItS1y0YXTySslLGqJZUFxwFH1DPlSg3R7ybYY3ATE');
    assert.equal(result.headers['surrogate-control'], 'max-age=30758400, stale-while-revalidate=30758400, stale-if-error=30758400, immutable');
  }).timeout(5000);

  it('Retrieves Missing Document from Google Docs', async function okGoogle() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'master',
      path: '/g/not-here.md',
    });

    assert.equal(result.statusCode, 404);
    assert.equal(result.body, 'error while converting document');
    assert.equal(result.headers['cache-control'], 'no-cache, private');
  }).timeout(5000);
});

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

describe('Google JSON Tests', () => {
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

  it('gets sheet by id from google', async function googleSheet() {
    const { server } = this.polly;
    scramble(server);

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'master',
      path: '/g/deeply/nested/folder/structure.json',
    }, {
      GOOGLE_DOCS2MD_CLIENT_ID: process.env.GOOGLE_DOCS2MD_CLIENT_ID || 'fake',
      GOOGLE_DOCS2MD_CLIENT_SECRET: process.env.GOOGLE_DOCS2MD_CLIENT_SECRET || 'fake',
      GOOGLE_DOCS2MD_REFRESH_TOKEN: process.env.GOOGLE_DOCS2MD_REFRESH_TOKEN || 'fake',
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.headers['x-source-location'], '1jXZBaOHP9x9-2NiYPbeyiWOHbmDRKobIeb11JdCVyUw');
    result.body = JSON.parse(result.body);
    assert.deepEqual(result.body.data, [{ depth: 1, name: 'deeply' },
      { depth: 2, name: 'nested' },
      { depth: 3, name: 'folder' },
      { depth: 4, name: 'structure' }]);
  }).timeout(50000);

  it('gets missing sheet by id from google', async function googleSheet() {
    const { server } = this.polly;
    scramble(server);

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'master',
      path: '/g/deeply/nested/folder/missing.json',
    }, {
      GOOGLE_DOCS2MD_CLIENT_ID: process.env.GOOGLE_DOCS2MD_CLIENT_ID || 'fake',
      GOOGLE_DOCS2MD_CLIENT_SECRET: process.env.GOOGLE_DOCS2MD_CLIENT_SECRET || 'fake',
      GOOGLE_DOCS2MD_REFRESH_TOKEN: process.env.GOOGLE_DOCS2MD_REFRESH_TOKEN || 'fake',
    });

    assert.equal(result.statusCode, 404);
  }).timeout(50000);

  it('handles bad json from google', async function googleSheet() {
    const { server } = this.polly;
    scramble(server);

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    server
      .get('https://adobeioruntime.net/*')
      .intercept((_, res) => {
        res.status(200).send('try parsing this');
      });

    const result = await main({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'master',
      path: '/g/data.json',
    }, {
      GOOGLE_DOCS2MD_CLIENT_ID: process.env.GOOGLE_DOCS2MD_CLIENT_ID || 'fake',
      GOOGLE_DOCS2MD_CLIENT_SECRET: process.env.GOOGLE_DOCS2MD_CLIENT_SECRET || 'fake',
      GOOGLE_DOCS2MD_REFRESH_TOKEN: process.env.GOOGLE_DOCS2MD_REFRESH_TOKEN || 'fake',
    });

    assert.equal(result.statusCode, 502);
  }).timeout(50000);

  it('handles google api error', async function googleSheet() {
    const { server } = this.polly;
    scramble(server);

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    server
      .post('https://oauth2.googleapis.com/token')
      .intercept((_, res) => {
        res.status(403).send('rate limit exceeded.');
      });

    const result = await main({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'master',
      path: '/g/data.json',
    }, {
      GOOGLE_DOCS2MD_CLIENT_ID: process.env.GOOGLE_DOCS2MD_CLIENT_ID || 'fake',
      GOOGLE_DOCS2MD_CLIENT_SECRET: process.env.GOOGLE_DOCS2MD_CLIENT_SECRET || 'fake',
      GOOGLE_DOCS2MD_REFRESH_TOKEN: process.env.GOOGLE_DOCS2MD_REFRESH_TOKEN || 'fake',
    });

    assert.equal(result.statusCode, 502);
  }).timeout(50000);

  it('handles bad response from runtime', async function googleSheet() {
    const { server } = this.polly;
    scramble(server);

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    server
      .get('https://adobeioruntime.net/*')
      .intercept((_, res) => {
        res.status(404).send('{}');
      });

    const result = await main({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'master',
      path: '/g/data.json',
    }, {
      GOOGLE_DOCS2MD_CLIENT_ID: process.env.GOOGLE_DOCS2MD_CLIENT_ID || 'fake',
      GOOGLE_DOCS2MD_CLIENT_SECRET: process.env.GOOGLE_DOCS2MD_CLIENT_SECRET || 'fake',
      GOOGLE_DOCS2MD_REFRESH_TOKEN: process.env.GOOGLE_DOCS2MD_REFRESH_TOKEN || 'fake',
    });

    assert.equal(result.statusCode, 404);
  }).timeout(50000);
});
