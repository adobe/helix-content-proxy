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
const { encrypt } = require('../src/credentials.js');
const { setupPolly, retrofit } = require('./utils.js');

// require('dotenv').config();

const fstab = `
mountpoints:
  /invalid: https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/invalid
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
  getDriveItemFromShareLink(url) {
    if (url === 'https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/invalid') {
      throw new Error('item not found');
    }
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
    if (path === '/word2md-unit-tests/adobe-stock-team') {
      return [{
        id: '01DJQLOW65RTXCQHBBGZFZ6IHSOUITJM2C',
        webUrl: 'https://adobe.sharepoint.com/sites/cg-helix/Shared%20Documents/word2md-unit-tests/adobe-stock-team.md',
      }];
    }
    return [];
  }
}

describe('Onedrive Edit Link Tests', () => {
  const { main: universalMain } = proxyquire('../src/index', {
    '@adobe/helix-onedrive-support': {
      OneDrive: FakeOneDrive,
      '@global': true,
    },
  });
  const main = retrofit(universalMain);

  setupPolly({
    recordIfMissing: false,
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

  it('Returns report for onedrive document', async function test() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      ...DEFAULT_PARAMS,
      report: true,
      edit: 'https://blog.adobe.com/en/publish/2020/11/09/adobe-to-acquire-workfront.html',
    });

    assert.equal(result.statusCode, 200);
    assert.deepEqual(JSON.parse(result.body), {
      editUrl: 'https://adobe.sharepoint.com/sites/TheBlog/_layouts/15/Doc.aspx?sourcedoc=%7B0F371509-EA33-49C1-A916-00F99214776F%7D&file=adobe-to-acquire-workfront.docx&action=default&mobileredirect=true',
      sourcePath: '/en/publish/2020/11/09/adobe-to-acquire-workfront.html',
    });
  }).timeout(20000);

  it('Returns report for onedrive document with hlx_report', async function test() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      ...DEFAULT_PARAMS,
      hlx_report: true,
      edit: 'https://blog.adobe.com/en/publish/2020/11/09/adobe-to-acquire-workfront.html',
    });

    assert.equal(result.statusCode, 200);
    assert.deepEqual(JSON.parse(result.body), {
      editUrl: 'https://adobe.sharepoint.com/sites/TheBlog/_layouts/15/Doc.aspx?sourcedoc=%7B0F371509-EA33-49C1-A916-00F99214776F%7D&file=adobe-to-acquire-workfront.docx&action=default&mobileredirect=true',
      sourcePath: '/en/publish/2020/11/09/adobe-to-acquire-workfront.html',
    });
  }).timeout(20000);

  it('Returns redirect for onedrive document (lnk)', async function test() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      ...DEFAULT_PARAMS,
      path: '/en/publish/2020/11/09/adobe-to-acquire-workfront.lnk',
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

  it('Returns redirect for onedrive sheet (lnk)', async function test() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      ...DEFAULT_PARAMS,
      path: '/en/query-index.json.lnk',
    });

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://adobe.sharepoint.com/sites/TheBlog/_layouts/15/Doc.aspx?sourcedoc=%7B9B11CF85-2856-4434-A536-3B1C13699D0F%7D&file=query-index.xlsx&action=default&mobileredirect=true');
  }).timeout(20000);

  it('Returns redirect for onedrive md', async function test() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      ...DEFAULT_PARAMS,
      edit: 'https://blog.adobe.com/word2md-unit-tests/adobe-stock-team.md',
    });

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://adobe.sharepoint.com/sites/cg-helix/Shared%20Documents/Forms/AllItems.aspx?id=%2Fsites%2Fcg-helix%2FShared+Documents%2Fword2md-unit-tests%2Fadobe-stock-team.md&parent=%2Fsites%2Fcg-helix%2FShared+Documents%2Fword2md-unit-tests&p=5');
  }).timeout(20000);

  it('Returns redirect for onedrive md (lnk)', async function test() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      ...DEFAULT_PARAMS,
      path: '/word2md-unit-tests/adobe-stock-team.lnk',
    });

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://adobe.sharepoint.com/sites/cg-helix/Shared%20Documents/Forms/AllItems.aspx?id=%2Fsites%2Fcg-helix%2FShared+Documents%2Fword2md-unit-tests%2Fadobe-stock-team.md&parent=%2Fsites%2Fcg-helix%2FShared+Documents%2Fword2md-unit-tests&p=5');
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

  it('Returns 404 for non existent sharelink', async function test() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      ...DEFAULT_PARAMS,
      edit: 'https://blog.adobe.com/invalid/en/2020/11/09/adobe-to-acquire-workfront.html',
    });

    assert.equal(result.statusCode, 404);
  }).timeout(20000);

  it('Returns 400 for invalid url', async function test() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      ...DEFAULT_PARAMS,
      edit: '<script>alert(document.domain)</script>',
    });

    assert.equal(result.statusCode, 400);
    assert.equal(result.headers['x-error'], 'Invalid URL');
  }).timeout(20000);

  it('Retrieves url for a private repository with credentials', async function okOnedrive() {
    const { server } = this.polly;
    // scramble(server);

    const REFRESH_TOKEN = 'fake-refresh-token';
    const FAKE_GITHUB_TOKEN = 'my-github-token';
    const creds = encrypt(FAKE_GITHUB_TOKEN, JSON.stringify({ r: REFRESH_TOKEN }));
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((req, res) => {
        if (req.headers.authorization !== 'token my-github-token') {
          res.status(404).send();
          return;
        }
        res.status(200).send(`
          mountpoints:
            /: 
              url: https://adobe.sharepoint.com/sites/cg-helix/Shared%20Documents/private
              credentials: ${creds}
          `);
      });

    const result = await main({
      ...DEFAULT_PARAMS,
      edit: 'https://blog.adobe.com/en/publish/2020/11/09/adobe-to-acquire-workfront.html',
    }, {
      GITHUB_TOKEN: FAKE_GITHUB_TOKEN,
      AZURE_WORD2MD_CLIENT_ID: process.env.AZURE_WORD2MD_CLIENT_ID || 'fake',
      AZURE_WORD2MD_CLIENT_SECRET: process.env.AZURE_WORD2MD_CLIENT_SECRET || 'fake',
    });

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://adobe.sharepoint.com/sites/TheBlog/_layouts/15/Doc.aspx?sourcedoc=%7B0F371509-EA33-49C1-A916-00F99214776F%7D&file=adobe-to-acquire-workfront.docx&action=default&mobileredirect=true');
  }).timeout(20000);
});
