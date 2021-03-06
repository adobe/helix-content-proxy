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
const assert = require('assert');
const vary = require('../src/vary.js');

describe('Vary unit tests', () => {
  it('Sets vary header', async () => {
    const result = await vary(() => ({
      headers: new Map(),
    }))();
    assert.equal(result.headers.get('vary'), 'x-ow-version-lock');
  });

  it('Adds vary header', async () => {
    const result = await vary(() => ({
      headers: new Map([['content-type', 'application/json']]),
    }))();
    assert.equal(result.headers.get('content-type'), 'application/json');
    assert.equal(result.headers.get('vary'), 'x-ow-version-lock');
  });

  it('Appends vary header', async () => {
    const result = await vary(() => ({
      headers: new Map([['vary', 'host']]),
    }))();
    assert.equal(result.headers.get('vary'), 'host,x-ow-version-lock');
  });

  it('Ignores vary header', async () => {
    const result = await vary(() => ({
      headers: new Map([['vary', 'x-ow-version-lock']]),
    }))();
    assert.equal(result.headers.get('vary'), 'x-ow-version-lock');
  });

  it('Ignores vary header (mixed case)', async () => {
    const result = await vary(() => ({
      headers: new Map([['vary', 'X-OW-Version-Lock']]),
    }))();
    assert.equal(result.headers.get('vary'), 'X-OW-Version-Lock');
  });
});
