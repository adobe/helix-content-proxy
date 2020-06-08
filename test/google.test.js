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

process.env.HELIX_FETCH_FORCE_HTTP1 = 'true';

const assert = require('assert');
const { main } = require('../src/index.js');
const { setupPolly } = require('./utils.js');

const fstab = `
mountpoints:
  /ms: https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/theblog
  /g: https://drive.google.com/drive/u/0/folders/1bH7_28a1-Q3QEEvFhT9eTmR-D7_9F4xP
`;

describe('Google Integration Tests', () => {
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
    assert.equal(result.headers['x-source-location'], 'https://adobeioruntime.net/api/v1/web/helix/helix-services/gdocs2md@v1?path=%2Fnothing&rootId=1bH7_28a1-Q3QEEvFhT9eTmR-D7_9F4xP&rid=&src=adobe%2Ftheblog%2Fmaster');
    assert.equal(result.headers['cache-control'], 'max-age=60');
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
    assert.equal(result.headers['cache-control'], 'max-age=60');
  }).timeout(5000);
});

describe('Google JSON Tests', () => {
  setupPolly({
    recordIfMissing: true,
  });

  it('gets sheet by id from google', async function googleSheet() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'master',
      path: '/g/deeply/nested/folder/structure.json',
      GOOGLE_DOCS2MD_CLIENT_ID: process.env.GOOGLE_DOCS2MD_CLIENT_ID,
      GOOGLE_DOCS2MD_CLIENT_SECRET: process.env.GOOGLE_DOCS2MD_CLIENT_SECRET,
      GOOGLE_DOCS2MD_REFRESH_TOKEN: process.env.GOOGLE_DOCS2MD_REFRESH_TOKEN,
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.headers['x-source-location'], 'https://docs.google.com/spreadsheets/d/1jXZBaOHP9x9-2NiYPbeyiWOHbmDRKobIeb11JdCVyUw/edit');
    assert.deepEqual(result.body, [{ depth: 1, name: 'deeply' },
      { depth: 2, name: 'nested' },
      { depth: 3, name: 'folder' },
      { depth: 4, name: 'structure' }]);
  }).timeout(50000);

  it('gets missing sheet by id from google', async function googleSheet() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'master',
      path: '/g/deeply/nested/folder/missing.json',
      GOOGLE_DOCS2MD_CLIENT_ID: process.env.GOOGLE_DOCS2MD_CLIENT_ID,
      GOOGLE_DOCS2MD_CLIENT_SECRET: process.env.GOOGLE_DOCS2MD_CLIENT_SECRET,
      GOOGLE_DOCS2MD_REFRESH_TOKEN: process.env.GOOGLE_DOCS2MD_REFRESH_TOKEN,
    });

    assert.equal(result.statusCode, 404);
  }).timeout(50000);

  it('handles bad json from google', async function googleSheet() {
    const { server } = this.polly;

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
      GOOGLE_DOCS2MD_CLIENT_ID: process.env.GOOGLE_DOCS2MD_CLIENT_ID,
      GOOGLE_DOCS2MD_CLIENT_SECRET: process.env.GOOGLE_DOCS2MD_CLIENT_SECRET,
      GOOGLE_DOCS2MD_REFRESH_TOKEN: process.env.GOOGLE_DOCS2MD_REFRESH_TOKEN,
    });

    assert.equal(result.statusCode, 502);
  }).timeout(50000);

  it('handles bad response from runtime', async function googleSheet() {
    const { server } = this.polly;

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
      GOOGLE_DOCS2MD_CLIENT_ID: process.env.GOOGLE_DOCS2MD_CLIENT_ID,
      GOOGLE_DOCS2MD_CLIENT_SECRET: process.env.GOOGLE_DOCS2MD_CLIENT_SECRET,
      GOOGLE_DOCS2MD_REFRESH_TOKEN: process.env.GOOGLE_DOCS2MD_REFRESH_TOKEN,
    });

    assert.equal(result.statusCode, 404);
  }).timeout(50000);
});
