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
/* eslint-disable global-require, class-methods-use-this, no-console,no-param-reassign */
process.env.HELIX_FETCH_FORCE_HTTP1 = 'true';
const assert = require('assert');
const { main } = require('../src/index');
const { setupPolly } = require('./utils.js');

// require('dotenv').config();

const fstab = `
mountpoints:
  /ms: https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/theblog
  /foo: unknown:12234
`;

const DEFAULT_PARAMS = {
  owner: 'adobe',
  repo: 'theblog',
  ref: 'master',
  path: '/',
  AZURE_WORD2MD_CLIENT_ID: process.env.AZURE_WORD2MD_CLIENT_ID || 'dummy',
  AZURE_WORD2MD_CLIENT_SECRET: process.env.AZURE_WORD2MD_CLIENT_SECRET || 'dummy',
  AZURE_HELIX_USER: process.env.AZURE_HELIX_USER || 'dummy',
  AZURE_HELIX_PASSWORD: process.env.AZURE_HELIX_PASSWORD || 'dummy',
};

describe('Github Edit Link Tests', () => {
  setupPolly({
    recordIfMissing: false,
  });

  it('Returns redirect for github document', async function test() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      ...DEFAULT_PARAMS,
      edit: 'https://blog.adobe.com/index.html',
    });

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://github.com/adobe/theblog/blob/master/index.md');
  });

  it('Returns redirect for github document with no fstab', async function test() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(404).send());

    const result = await main({
      ...DEFAULT_PARAMS,
      edit: 'https://blog.adobe.com/index.html',
    });

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://github.com/adobe/theblog/blob/master/index.md');
  });

  it('Returns 404 for document with no handler', async function test() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      ...DEFAULT_PARAMS,
      edit: 'https://blog.adobe.com/foo/index.html',
    });

    assert.equal(result.statusCode, 404);
  });
});
