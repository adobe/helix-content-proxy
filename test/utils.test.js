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
const { appendURLParams, getFetchOptions } = require('../src/utils');

describe('Utils unit tests', () => {
  it('Test appendURLParams', () => {
    assert.equal(appendURLParams('https://example.com', { foo: 'bar' }), 'https://example.com/?foo=bar');
  });

  it('Creates fetch options correctly', () => {
    assert.deepEqual(getFetchOptions({
      cache: 'no-store',
      SUPER_SECRET: 'foo',
      requestId: '1234',
    }), {
      cache: 'no-store',
      headers: {
        'x-request-id': '1234',
      },
    });
  });
});
