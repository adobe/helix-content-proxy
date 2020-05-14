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
const index = require('../src/index.js').main;

describe('GitHub Integration Tests', () => {
  it('Retrieves Markdown from GitHub', async () => {
    const result = await index({
      owner: 'adobe',
      repo: 'helix-pipeline',
      ref: '9526b3b315a8b8a5e48c8e70fff362bf43426020',
      path: 'docs/markdown.md',
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.indexOf('# Markdown Features in Project Helix'), 0);
  });
});
