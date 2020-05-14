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
const index = require('../src/index.js').main;
const { setupPolly } = require('./utils.js');

describe('Index Tests', () => {
  setupPolly({
    recordIfMissing: false,
  });

  it('index function is present', async () => {
    const result = await index({});
    assert.deepEqual(result.statusCode, 400);
  });

  it('index function returns an object', async () => {
    const result = await index();
    assert.equal(typeof result, 'object');
  });

  it('index bails if mount point is not supported', async function badMountpoint() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/fake/fstab.yaml')
      .intercept((_, res) => res.status(200).send(`
mountpoints:
  /foo: https://www.example.com/`));

  const result = await index({
    owner: 'adobe',
    repo: 'theblog',
    ref: 'fake',
    path: '/foo/index.md',
  });

  assert.equal(result.statusCode, 501);
  });
});
