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
});
