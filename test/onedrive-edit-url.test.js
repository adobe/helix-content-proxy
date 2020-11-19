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
const proxyquire = require('proxyquire');
const { setupPolly } = require('./utils.js');

// require('dotenv').config();

const fstab = `
mountpoints:
  /: https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/theblog
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

class FakeOneDrive {
  getDriveItemFromShareLink() {
    return {
      id: '01DJQLOW4XEPSY5ROSRRE3SF2L7KJDG7TW',
      webUrl: 'https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents',
      parentReference: {
        driveId: 'b!PpnkewKFAEaDTS6slvlVjh_3ih9lhEZMgYWwps6bPIWZMmLU5xGqS4uES8kIQZbH',
        driveType: 'documentLibrary',
      },
    };
  }

  fuzzyGetDriveItem(_, path) {
    if (path === '/en/query-index') {
      return [{
        id: '01DJQLOW65RTXCQHBBGZFZ6IHSOUITJM2C',
        webUrl: 'https://adobe.sharepoint.com/sites/TheBlog/_layouts/15/Doc.aspx?sourcedoc=%7B9B11CF85-2856-4434-A536-3B1C13699D0F%7D&file=query-index.xlsx&action=default&mobileredirect=true',
      }];
    }
    if (path === '/en/publish/2020/11/09/adobe-to-acquire-workfront') {
      return [{
        id: '01DJQLOW65RTXCQHBBGZFZ6IHSOUITJM2C',
        webUrl: 'https://adobe.sharepoint.com/sites/TheBlog/_layouts/15/Doc.aspx?sourcedoc=%7B0F371509-EA33-49C1-A916-00F99214776F%7D&file=adobe-to-acquire-workfront.docx&action=default&mobileredirect=true',
      }];
    }
    return [];
  }
}

describe('Onedrive Edit Link Tests', () => {
  const { main } = proxyquire('../src/index', {
    '@adobe/helix-onedrive-support': {
      OneDrive: FakeOneDrive,
      '@global': true,
    },
  });
  // const { main } = require('../src/index');

  setupPolly({
    recordIfMissing: true,
  });

  it('Returns redirect for onedrive document', async function test() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      ...DEFAULT_PARAMS,
      edit: 'https://blog.adobe.com/en/publish/2020/11/09/adobe-to-acquire-workfront.html',
    });

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://adobe.sharepoint.com/sites/TheBlog/_layouts/15/Doc.aspx?sourcedoc=%7B0F371509-EA33-49C1-A916-00F99214776F%7D&file=adobe-to-acquire-workfront.docx&action=default&mobileredirect=true');
  }).timeout(20000);

  it('Returns redirect for onedrive sheet', async function test() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      ...DEFAULT_PARAMS,
      edit: 'https://blog.adobe.com/en/query-index.json',
    });

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://adobe.sharepoint.com/sites/TheBlog/_layouts/15/Doc.aspx?sourcedoc=%7B9B11CF85-2856-4434-A536-3B1C13699D0F%7D&file=query-index.xlsx&action=default&mobileredirect=true');
  }).timeout(20000);

  it('Returns 404 for non existent document', async function test() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      ...DEFAULT_PARAMS,
      edit: 'https://blog.adobe.com/foo/bar.html',
    });

    assert.equal(result.statusCode, 404);
  }).timeout(20000);
});
