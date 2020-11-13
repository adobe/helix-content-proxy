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

'use strict';

const assert = require('assert');
const { main } = require('../src/index.js');
const { setupPolly } = require('./utils.js');

describe('Index Tests', () => {
  setupPolly({
    recordIfMissing: false,
  });

  it('index function is present', async () => {
    const result = await main({});
    assert.equal(result.statusCode, 400);
  });

  it('index function returns an object', async () => {
    const result = await main();
    assert.equal(typeof result, 'object');
  });

  it('index bails if mount point is not supported', async function badMountpoint() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a4/fstab.yaml')
      .intercept((_, res) => res.status(200).send(`
mountpoints:
  /foo: https://www.example.com/`));

    const result = await main({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'cb8a0dc5d9d89b800835166783e4130451d3c6a4',
      path: '/foo/index.md',
      'hlx_p.limit': 1,
      'hlx_p.offset': 1,
    });
    assert.equal(result.statusCode, 501);
  });

  it('index returns 404 on invalid path', async () => {
    const result = await main({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'cb8a0dc5d9d89b800835166783e4130451d3c6a4',
      path: '//foo/index.md',
    });

    assert.equal(result.statusCode, 404);
  });

  it('index respects version lock header', async function invalidPath() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/db8a0dc5d9d89b800835166783e4130451d3c6a4/fstab.yaml')
      .intercept((_, res) => res.status(200).send(`
mountpoints:
  /foo: onedrive:/drives/1234/items/5678`));
    server
      .get('https://adobeioruntime.net/api/v1/web/helix/helix-services/word2md@ci112233')
      .intercept((_, res) => res.status(200).send('## Welcome'));

    const result = await main({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'db8a0dc5d9d89b800835166783e4130451d3c6a4',
      path: '/foo/index.md',
      __ow_headers: {
        'x-ow-version-lock': 'word2md=word2md@ci112233',
      },
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body, '## Welcome');
  });

  it('index returns 404 if no reverse handler can process the lookup', async function noReverse() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a4/fstab.yaml')
      .intercept((_, res) => res.status(200).send(`
mountpoints:
  /foo: https://www.example.com/`));

    const result = await main({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'cb8a0dc5d9d89b800835166783e4130451d3c6a4',
      path: '/',
      lookup: 'https://www.foo.com',
    });

    assert.equal(result.statusCode, 404);
  });

  it('index returns 504 upon timeout', async function shortTimeout() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a3/fstab.yaml')
      .intercept(async (_, res) => {
        await server.timeout(50);
        res.sendStatus(500);
      });

    // eslint-disable-next-line no-underscore-dangle
    process.env.__OW_NAMESPACE = 'helix-mini';

    const result = await main({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'cb8a0dc5d9d89b800835166783e4130451d3c6a3',
      path: '/foo/index.md',
      HTTP_TIMEOUT: 10,
      limit: 1,
      offset: 1,
    });

    // eslint-disable-next-line no-underscore-dangle
    delete process.env.__OW_NAMESPACE;

    assert.equal(result.statusCode, 504);
  });

  it('index forwards sheet and table params to data-embed', async function test() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/foo-branch/fstab.yaml')
      .intercept((_, res) => res.status(200).send(`
mountpoints:
  /: onedrive:/drives/dummy_driveId/items/dummy_rootId`));

    server
      .post('https://login.windows.net/common/oauth2/token?api-version=1.0')
      .intercept((_, res) => res.status(200).send({
        token_type: 'Bearer',
        refresh_token: 'dummy',
        access_token: 'dummy',
        expires_in: 81000,
      }));

    server
      .get('https://graph.microsoft.com/v1.0/drives/dummy_driveId/items/dummy_rootId:/en/drafts/query-index.xlsx')
      .intercept((_, res) => res.status(200).send({
        id: '1234',
        parentReference: {
          driveId: 'dummy_driveId',
        },
      }));

    server
      .get('https://adobeioruntime.net/api/v1/web/helix/helix-services/data-embed@v2?sheet=all&table=test&src=onedrive%3A%2Fdrives%2Fdummy_driveId%2Fitems%2F1234')
      .intercept((req, res) => {
        assert.deepEqual(req.query, {
          sheet: 'all',
          table: 'test',
          src: 'onedrive:/drives/dummy_driveId/items/1234',
        });
        res.status(200).send({
          data: [
            { name: 'test', value: '1234' },
          ],
        });
      });

    const result = await main({
      AZURE_WORD2MD_CLIENT_ID: 'fake',
      AZURE_WORD2MD_CLIENT_SECRET: 'fake',
      AZURE_WORD2MD_REFRESH_TOKEN: 'dummy',
      owner: 'adobe',
      repo: 'theblog',
      ref: 'foo-branch',
      path: '/en/drafts/query-index.json',
      sheet: 'all',
      table: 'test',
      'hlx_p.limit': 1,
      'hlx_p.offset': 1,
    });
    assert.deepStrictEqual(result, {
      body: {
        data: [
          {
            name: 'test',
            value: '1234',
          },
        ],
      },
      headers: {
        'cache-control': null,
        'content-type': 'application/json',
        'surrogate-control': 'max-age=30758400, stale-while-revalidate=30758400, stale-if-error=30758400, immutable',
        'surrogate-key': 'ERUhf9+V6/T5sTc/',
        'x-source-location': '/drives/dummy_driveId/items/1234',
        vary: 'x-ow-version-lock',
      },
      statusCode: 200,
    });
  });
});
