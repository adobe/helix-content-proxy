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
const cache = require('../src/cache.js');

const { setupPolly, retrofit } = require('./utils.js');

// require('dotenv').config();
const main = retrofit(universalMain);

const fstab = `
mountpoints:
  /: https://drive.google.com/drive/u/0/folders/1DS-ZKyRuwZkMPIDeuKxNMQnKDrcw1_aw
`;

const DEFAULT_PARAMS = {
  owner: 'adobe',
  repo: 'pages',
  ref: 'master',
  path: '/',
};

const DEFAULT_ENV = {
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

describe('Google Edit Link Tests', () => {
  before(() => {
    // clear cache for tests
    cache.options({ max: 1000 });
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

  it('Returns redirect for google based page', async function test() {
    const { server } = this.polly;
    scramble(server);

    server
      .get('https://raw.githubusercontent.com/adobe/pages/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      ...DEFAULT_PARAMS,
      edit: 'https://pages.adobe.com/creativecloud/en/ete/how-adobe-apps-work-together/index.html',
    }, DEFAULT_ENV);

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://docs.google.com/document/d/14351arsFQspbpbwYXhOPQsogHm9aTXFGHnIM1lviG5Q/edit');
  }).timeout(50000);

  it('Returns redirect for google based page (lnk)', async function test() {
    const { server } = this.polly;
    scramble(server);

    server
      .get('https://raw.githubusercontent.com/adobe/pages/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      ...DEFAULT_PARAMS,
      path: '/creativecloud/en/ete/how-adobe-apps-work-together/index.lnk',
    }, DEFAULT_ENV);

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://docs.google.com/document/d/14351arsFQspbpbwYXhOPQsogHm9aTXFGHnIM1lviG5Q/edit');
  }).timeout(50000);

  it('Returns redirect for google based page (.html.lnk)', async function test() {
    const { server } = this.polly;
    scramble(server);

    server
      .get('https://raw.githubusercontent.com/adobe/pages/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      ...DEFAULT_PARAMS,
      path: '/creativecloud/en/ete/how-adobe-apps-work-together/index.html.lnk',
    }, DEFAULT_ENV);

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://docs.google.com/document/d/14351arsFQspbpbwYXhOPQsogHm9aTXFGHnIM1lviG5Q/edit');
  }).timeout(50000);

  it('Returns redirect for google based page (no extension)', async function test() {
    const { server } = this.polly;
    scramble(server);

    server
      .get('https://raw.githubusercontent.com/adobe/pages/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      ...DEFAULT_PARAMS,
      edit: 'https://pages.adobe.com/creativecloud/en/ete/how-adobe-apps-work-together/index',
    }, DEFAULT_ENV);

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://docs.google.com/document/d/14351arsFQspbpbwYXhOPQsogHm9aTXFGHnIM1lviG5Q/edit');
  }).timeout(50000);

  it('Returns redirect for google based page (directory)', async function test() {
    const { server } = this.polly;
    scramble(server);

    server
      .get('https://raw.githubusercontent.com/adobe/pages/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      ...DEFAULT_PARAMS,
      edit: 'https://pages.adobe.com/creativecloud/en/ete/how-adobe-apps-work-together/',
    }, DEFAULT_ENV);

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://docs.google.com/document/d/14351arsFQspbpbwYXhOPQsogHm9aTXFGHnIM1lviG5Q/edit');
  }).timeout(50000);

  it('Returns redirect for google based spreadsheet', async function test() {
    const { server } = this.polly;
    scramble(server);

    server
      .get('https://raw.githubusercontent.com/adobe/pages/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      ...DEFAULT_PARAMS,
      edit: 'https://pages.adobe.com/redirects.json',
    }, DEFAULT_ENV);

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://docs.google.com/spreadsheets/d/1TizK03uKRn2bP_n69U8qCRcaCIkLEFF95rKBZWWKrew/edit');
  }).timeout(50000);

  it('Returns redirect for google based spreadsheet (lnk)', async function test() {
    const { server } = this.polly;
    scramble(server);

    server
      .get('https://raw.githubusercontent.com/adobe/pages/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      ...DEFAULT_PARAMS,
      path: '/redirects.json.lnk',
    }, DEFAULT_ENV);

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://docs.google.com/spreadsheets/d/1TizK03uKRn2bP_n69U8qCRcaCIkLEFF95rKBZWWKrew/edit');
  }).timeout(50000);

  it('Returns 404 for non existent document', async function test() {
    const { server } = this.polly;
    scramble(server);

    server
      .get('https://raw.githubusercontent.com/adobe/pages/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      ...DEFAULT_PARAMS,
      edit: 'https://pages.adobe.com/foo/bar.html',
    }, DEFAULT_ENV);

    assert.equal(result.statusCode, 404);
  }).timeout(50000);
});
