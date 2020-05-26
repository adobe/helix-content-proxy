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

process.env.FORCE_HTTP1 = 'true';

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

  after(() => {
    delete process.env.FORCE_HTTP1;
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
