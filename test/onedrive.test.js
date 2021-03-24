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
const { setupPolly, retrofit } = require('./utils.js');

const fstab = `
mountpoints:
  /onedrive-index.md: "onedrive:/drives/b!PpnkewKFAEaDTS6slvlVjh_3ih9lhEZMgYWwps6bPIWZMmLU5xGqS4uES8kIQZbH/items/01DJQLOW44UHM362CKX5GYMQO2F4JIHSEV"
  /: https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/theblog
`;

const index = retrofit(main);

describe('OneDrive Integration Tests', () => {
  setupPolly({
    recordIfMissing: false,
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
    assert.equal(result.headers['x-error'], 'Unable to fetch adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a6/not-here (404) from word2md: no matching documents for "/not-here.docx"');
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
});
