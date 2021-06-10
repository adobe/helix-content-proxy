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
const { encrypt } = require('../src/credentials.js');
const { main } = require('../src/index.js');
const { setupPolly, retrofit } = require('./utils.js');

const fstab = `
mountpoints:
  /onedrive-index.md: "onedrive:/drives/b!PpnkewKFAEaDTS6slvlVjh_3ih9lhEZMgYWwps6bPIWZMmLU5xGqS4uES8kIQZbH/items/01DJQLOW44UHM362CKX5GYMQO2F4JIHSEV"
  /: https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/theblog
`;

// require('dotenv').config();
const index = retrofit(main);

function scramble(server) {
  server.any().on('beforePersist', (_, recording) => {
    recording.request.headers = recording.request.headers.filter(({ name }) => name !== 'authorization');
    delete recording.request.postData;

    if (recording.request.url === 'https://login.windows.net/common/oauth2/token?api-version=1.0') {
      const val = JSON.parse(recording.response.content.text);
      val.access_token = val.access_token
        .replace(/[A-Z]/g, 'A')
        .replace(/[0-9]/g, '0')
        .replace(/[a-z]/g, 'a');
      val.refresh_token = val.refresh_token
        .replace(/[A-Z]/g, 'A')
        .replace(/[0-9]/g, '0')
        .replace(/[a-z]/g, 'a');
      val.id_token = val.id_token
        .replace(/[A-Z]/g, 'A')
        .replace(/[0-9]/g, '0')
        .replace(/[a-z]/g, 'a');

      recording.response.content.text = JSON.stringify(val);
    }
  });
}

describe('OneDrive Integration Tests', () => {
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

  it('Retrieves Document from Word', async function okOnedrive() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a5/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await index({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'cb8a0dc5d9d89b800835166783e4130451d3c6a5',
      path: '/index.md',
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.indexOf('# The Blog | Welcome to Adobe Blog'), 0);
    assert.equal(result.headers['x-source-location'], '/drives/b!PpnkewKFAEaDTS6slvlVjh_3ih9lhEZMgYWwps6bPIWZMmLU5xGqS4uES8kIQZbH/items/01DJQLOW44UHM362CKX5GYMQO2F4JIHSEV');
    assert.equal(result.headers['surrogate-control'], 'max-age=30758400, stale-while-revalidate=30758400, stale-if-error=30758400, immutable');
    assert.equal(result.headers.vary, 'x-ow-version-lock');
  }).timeout(5000);

  it('Retrieves Document from Word with If-Modified-Since', async function okOnedrive() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a5/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await index({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'cb8a0dc5d9d89b800835166783e4130451d3c6a5',
      path: '/index.md',
      __ow_headers: {
        'if-modified-since': 'Tue, 01 Jun 2021 20:04:53 GMT',
      },
    });

    assert.equal(result.statusCode, 304);
  }).timeout(5000);

  it('Handles 429s from Sharepoint', async function onedrive429() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/spark-website/cb8a0dc5d9d89b800835166783e4130451d3c6a5/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    server
      .get('https://adobeioruntime.net/api/v1/web/helix/helix-services/word2md@v2')
      .intercept((_, res) => res.status(429).send('Too many requests'));

    const result1 = await index({
      owner: 'adobe',
      repo: 'spark-website',
      ref: 'cb8a0dc5d9d89b800835166783e4130451d3c6a5',
      path: '/index.md',
    });

    assert.equal(result1.statusCode, 503, 'First response should be a 503 due to backend 429');

    const result2 = await index({
      owner: 'adobe',
      repo: 'spark-website',
      ref: 'cb8a0dc5d9d89b800835166783e4130451d3c6a5',
      path: '/index.md',
    });

    assert.equal(result2.statusCode, 429, 'Second response should be a preemptive 429 to preserve rate limits for other clients');
  }).timeout(5000);

  it('Retrieves Document mounted md from Word', async function okOnedrive() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a5/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await index({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'cb8a0dc5d9d89b800835166783e4130451d3c6a5',
      path: '/onedrive-index.md',
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.indexOf('# The Blog | Welcome to Adobe Blog'), 0);
    assert.equal(result.headers['x-source-location'], '/drives/b!PpnkewKFAEaDTS6slvlVjh_3ih9lhEZMgYWwps6bPIWZMmLU5xGqS4uES8kIQZbH/items/01DJQLOW44UHM362CKX5GYMQO2F4JIHSEV');
    assert.equal(result.headers['surrogate-control'], 'max-age=30758400, stale-while-revalidate=30758400, stale-if-error=30758400, immutable');
  }).timeout(5000);

  it('Retrieves Missing Document from Word', async function missingOnedrive() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a6/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await index({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'cb8a0dc5d9d89b800835166783e4130451d3c6a6',
      path: '/not-here.md',
    });

    assert.equal(result.statusCode, 404);
    assert.equal(result.body, '');
    assert.equal(result.headers['x-error'], 'Unable to fetch adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a6/not-here (404) from word2md: ');
    assert.equal(result.headers['cache-control'], 'max-age=60');
  }).timeout(5000);

  it('delivers /head.md from github even if matches 1d mountpoint', async function test() {
    const { server } = this.polly;
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a6/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a6/head.md')
      .intercept((_, res) => res.status(404).send());

    const result = await index({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'cb8a0dc5d9d89b800835166783e4130451d3c6a6',
      path: '/head.md',
    });

    assert.equal(result.statusCode, 404);
  });

  it('delivers /header.md from github even if matches 1d mountpoint', async function test() {
    const { server } = this.polly;
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a6/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a6/header.md')
      .intercept((_, res) => res.status(200).send('# Hello, world'));

    const result = await index({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'cb8a0dc5d9d89b800835166783e4130451d3c6a6',
      path: '/header.md',
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body, '# Hello, world');
  });

  it('delivers /footer.md from github even if matches 1d mountpoint', async function test() {
    const { server } = this.polly;
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a6/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a6/footer.md')
      .intercept((_, res) => res.status(200).send('# Hello, world'));

    const result = await index({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'cb8a0dc5d9d89b800835166783e4130451d3c6a6',
      path: '/footer.md',
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body, '# Hello, world');
  });

  it('Retrieves Document from a private repository with credentials', async function okOnedrive() {
    const { server } = this.polly;
    scramble(server);

    const REFRESH_TOKEN = 'fake-refresh-token';
    const FAKE_GITHUB_TOKEN = 'my-github-token';
    const creds = encrypt(FAKE_GITHUB_TOKEN, JSON.stringify({ r: REFRESH_TOKEN }));
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((req, res) => {
        if (req.headers.authorization !== 'token my-github-token') {
          res.status(404).send();
          return;
        }
        res.status(200).send(`
          mountpoints:
            /:
              url: https://adobe.sharepoint.com/sites/cg-helix/Shared%20Documents/private
              credentials: ${creds}
          `);
      });

    const result = await index({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'master',
      path: '/index.md',
    }, {
      GITHUB_TOKEN: FAKE_GITHUB_TOKEN,
      AZURE_WORD2MD_CLIENT_ID: process.env.AZURE_WORD2MD_CLIENT_ID || 'fake',
      AZURE_WORD2MD_CLIENT_SECRET: process.env.AZURE_WORD2MD_CLIENT_SECRET || 'fake',
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body, 'Hello my little secret...\n');
  }).timeout(20000);

  it('Retrieves Document from a private repository with user credentials', async function okOnedrive() {
    const { server } = this.polly;
    scramble(server);

    const FAKE_GITHUB_TOKEN = 'my-other-token';
    const creds = encrypt(FAKE_GITHUB_TOKEN, JSON.stringify({ u: 'helix@adobe.com', p: 'xyz' }));
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((req, res) => {
        if (req.headers.authorization !== 'token my-other-token') {
          res.status(404).send();
          return;
        }
        res.status(200).send(`
          mountpoints:
            /:
              url: https://adobe.sharepoint.com/sites/cg-helix/Shared%20Documents/word2md-unit-tests
              credentials: ${creds}
          `);
      });

    const result = await index({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'master',
      path: '/breaks.md',
    }, {
      GITHUB_TOKEN: FAKE_GITHUB_TOKEN,
      AZURE_WORD2MD_CLIENT_ID: process.env.AZURE_WORD2MD_CLIENT_ID || 'fake',
      AZURE_WORD2MD_CLIENT_SECRET: process.env.AZURE_WORD2MD_CLIENT_SECRET || 'fake',
    });

    assert.equal(result.statusCode, 200);
    assert.ok(result.body.startsWith('# Breaks\n'));
  }).timeout(20000);

  it('Retrieves Document from a private repository with unknown credentials', async function okOnedrive() {
    // in this case, the access token is ignored and the default auth in word2md is used.
    const { server } = this.polly;
    scramble(server);

    const FAKE_GITHUB_TOKEN = 'my-other-token';
    const creds = encrypt(FAKE_GITHUB_TOKEN, JSON.stringify({ s: 'foobar' }));
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/otherbranch/fstab.yaml')
      .intercept((req, res) => {
        if (req.headers.authorization !== 'token my-other-token') {
          res.status(404).send();
          return;
        }
        res.status(200).send(`
          mountpoints:
            /:
              url: https://adobe.sharepoint.com/sites/cg-helix/Shared%20Documents/word2md-unit-tests
              credentials: ${creds}
          `);
      });

    const result = await index({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'otherbranch',
      path: '/breaks.md',
    }, {
      GITHUB_TOKEN: FAKE_GITHUB_TOKEN,
      AZURE_WORD2MD_CLIENT_ID: process.env.AZURE_WORD2MD_CLIENT_ID || 'fake',
    });

    assert.equal(result.statusCode, 200);
    assert.ok(result.body.startsWith('# Breaks\n'));
  }).timeout(20000);

  it('Returns 404 from private repository with wrong token', async function okOnedrive() {
    const { server } = this.polly;
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((req, res) => {
        res.status(404).send();
      });
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/index.md')
      .intercept((req, res) => {
        if (req.headers.authorization !== 'token my-github-token') {
          res.status(404).send();
          return;
        }
        res.status(200).send('# welcome');
      });

    const result = await index({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'master',
      path: '/index.md',
    }, {
      GITHUB_TOKEN: 'wrong-token',
    });

    assert.equal(result.statusCode, 404);
  });
});
