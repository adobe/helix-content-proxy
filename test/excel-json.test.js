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

const { handleJSON } = require('../src/excel-json');

describe('Excel JSON Integration tests', () => {
  it('Get sharelink from path', async () => {
    const res = await handleJSON({
      mp: {
        url: 'https://adobe.sharepoint.com/sites/TheBlog',
        relPath: '/admin/importer/urls'
      },
      log: {
        debug: console.log,
        info: console.log,
        warn: console.log,
        error: console.log,
      },
      options: {
        AZURE_WORD2MD_CLIENT_ID: process.env.AZURE_WORD2MD_CLIENT_ID || 'fake',
        AZURE_WORD2MD_CLIENT_SECRET: process.env.AZURE_WORD2MD_CLIENT_SECRET || 'fake',
        AZURE_WORD2MD_REFRESH_TOKEN: process.env.AZURE_WORD2MD_REFRESH_TOKEN || 'fake',
        AZURE_HELIX_USER: process.env.AZURE_HELIX_USER || 'fake',
        AZURE_HELIX_PASSWORD: process.env.AZURE_HELIX_PASSWORD || 'fake',
      }
    });
  }).timeout(50000);
});