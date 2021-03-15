/*
 * Copyright 2021 Adobe. All rights reserved.
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
const zlib = require('zlib');
const { main: universalMain } = require('../src/index.js');
const { setupPolly, retrofit } = require('./utils.js');
const cache = require('../src/cache.js');

// require('dotenv').config();

const main = retrofit(universalMain);

const fstab = `
mountpoints:
  /ms: https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/theblog
  /g: https://drive.google.com/drive/u/2/folders/1vjng4ahZWph-9oeaMae16P9Kbb3xg4Cg
  /google-home.md: gdrive:1GIItS1y0YXTySslLGqJZUFxwFH1DPlSg3R7ybYY3ATE
`;

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
      const val = JSON.parse(zlib.gunzipSync(Buffer.from(JSON.parse(recording.response.content.text).join(''), 'hex')));
      if (val.access_token) {
        val.access_token = val.access_token
          .replace(/[A-Z]/g, 'A')
          .replace(/[0-9]/g, '0')
          .replace(/[a-z]/g, 'a');
      }
      const buf = JSON.stringify([zlib.gzipSync(Buffer.from(JSON.stringify(val), 'utf8')).toString('hex')]);
      recording.response.content.text = buf;
    }
  });
}

describe('Google Sitemap Tests', () => {
  beforeEach(() => {
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

  it('Retrieves sitemap from Google Drive', async function test() {
    const { server } = this.polly;
    scramble(server);

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/g/sitemap.xml')
      .intercept((_, res) => res.status(404).send());

    const result = await main({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'master',
      path: '/g/sitemap.xml',
    }, DEFAULT_ENV);

    assert.equal(result.statusCode, 200);
    assert.equal(result.headers['x-source-location'], '1BTZv0jmGKbEJ3StwgG3VwCbPu4RFRH8s');
    assert.equal(result.headers['content-type'], 'application/xml');
    assert.ok(result.body.indexOf('<loc>https://blog.adobe.com/en/publish/2021/02/23/advocates-family-life.html</loc>') > 0);
  }).timeout(50000);

  it('Serves 404 for missing sitemap from Google Drive', async function test() {
    const { server } = this.polly;
    scramble(server);

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/g/sitemap.xml')
      .intercept((_, res) => res.status(404).send());

    const result = await main({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'master',
      path: '/g/sitemap-en.xml',
    }, DEFAULT_ENV);

    assert.equal(result.statusCode, 404);
  }).timeout(50000);

  it('Propagates error from google drive', async function test() {
    const { server } = this.polly;
    scramble(server);

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/g/sitemap.xml')
      .intercept((_, res) => res.status(404).send());

    const result = await main({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'master',
      path: '/g/sitemap-en.xml',
    }, {
      ...DEFAULT_ENV,
      GOOGLE_DOCS2MD_REFRESH_TOKEN: 'invalid',
    });

    assert.equal(result.statusCode, 502);
  }).timeout(50000);
});
