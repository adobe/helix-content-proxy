/*
 * Copyright 2021 Adobe. All rights reserved.
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

process.env.HELIX_FETCH_FORCE_HTTP1 = 'true';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { main } = require('../src/index.js');
const { setupPolly, retrofit } = require('./utils.js');

const readFile = promisify(fs.readFile);

const DUMMY_ENV = {
  AZURE_WORD2MD_CLIENT_ID: 'dummy',
  AZURE_WORD2MD_CLIENT_SECRET: 'dummy',
  AZURE_WORD2MD_REFRESH_TOKEN: 'dummy',
};

const fstab = `
mountpoints:
  /onedrive-index.md: "onedrive:/drives/b!PpnkewKFAEaDTS6slvlVjh_3ih9lhEZMgYWwps6bPIWZMmLU5xGqS4uES8kIQZbH/items/01DJQLOW44UHM362CKX5GYMQO2F4JIHSEV"
  /: https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/theblog
`;

const index = retrofit(main);

describe('OneDrive Integration Tests (Sitemap)', () => {
  setupPolly({
    recordIfMissing: false,
  });

  it('Retrieves Sitemap from onedirve', async function okOnedrive() {
    const sitemap = await readFile(path.resolve(__dirname, 'fixtures/sitemap.xml'), 'utf-8');

    const { server } = this.polly;
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a5/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a5/en/drafts/tripod/sitemap.xml')
      .intercept((_, res) => res.status(404).send());

    server
      .post('https://login.windows.net/common/oauth2/token?api-version=1.0')
      .intercept((_, res) => res.status(200).json({
        token_type: 'Bearer',
        refresh_token: 'dummy',
        access_token: 'dummy',
        expires_in: 81000,
      }));

    server
      .get('https://graph.microsoft.com/v1.0/shares/u!aHR0cHM6Ly9hZG9iZS5zaGFyZXBvaW50LmNvbS9zaXRlcy9UaGVCbG9nL1NoYXJlZCUyMERvY3VtZW50cy90aGVibG9n/driveItem')
      .intercept((_, res) => res.status(200).json({
        id: 'folderId',
        parentReference: {
          driveId: 'driveid',
        },
      }));

    server
      .get('https://graph.microsoft.com/v1.0/drives/driveid/items/folderId:/en/drafts/tripod:/children')
      .intercept((_, res) => res.status(200).json({
        value: [{
          file: { mimeType: 'dummy' },
          name: 'sitemap.xml',
          id: 'docId',
          parentReference: {
            driveId: 'driveid',
          },
        }],
      }));

    server
      .get('https://graph.microsoft.com/v1.0/drives/driveid/items/docId/content')
      .intercept((_, res) => res.status(200).send(sitemap));

    const result = await index({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'cb8a0dc5d9d89b800835166783e4130451d3c6a5',
      path: '/en/drafts/tripod/sitemap.xml',
    }, DUMMY_ENV);

    assert.equal(result.statusCode, 200);
    assert.equal(result.headers['content-type'], 'application/xml');
    assert.ok(result.body.indexOf('<loc>https://blog.adobe.com/en/publish/2021/02/23/advocates-family-life.html</loc>') > 0);
    assert.equal(result.headers['x-source-location'], '/drives/driveid/items/docId');
    assert.equal(result.headers['surrogate-control'], 'max-age=30758400, stale-while-revalidate=30758400, stale-if-error=30758400, immutable');
    assert.equal(result.headers.vary, 'x-ow-version-lock');
  }).timeout(5000);

  it('Reports 404 for non existent sitemap from onedirve', async function okOnedrive() {
    const { server } = this.polly;
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a5/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a5/en/drafts/tripod/sitemap.xml')
      .intercept((_, res) => res.status(404).send());

    server
      .post('https://login.windows.net/common/oauth2/token?api-version=1.0')
      .intercept((_, res) => res.status(200).json({
        token_type: 'Bearer',
        refresh_token: 'dummy',
        access_token: 'dummy',
        expires_in: 81000,
      }));

    server
      .get('https://graph.microsoft.com/v1.0/shares/u!aHR0cHM6Ly9hZG9iZS5zaGFyZXBvaW50LmNvbS9zaXRlcy9UaGVCbG9nL1NoYXJlZCUyMERvY3VtZW50cy90aGVibG9n/driveItem')
      .intercept((_, res) => res.status(200).json({
        id: 'folderId',
        parentReference: {
          driveId: 'driveid',
        },
      }));

    server
      .get('https://graph.microsoft.com/v1.0/drives/driveid/items/folderId:/en/drafts/tripod:/children')
      .intercept((_, res) => res.status(200).json({
        value: [],
      }));

    const result = await index({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'cb8a0dc5d9d89b800835166783e4130451d3c6a5',
      path: '/en/drafts/tripod/sitemap.xml',
    }, DUMMY_ENV);

    assert.equal(result.statusCode, 404);
  }).timeout(5000);

  it('Propagates errors from onedirve', async function okOnedrive() {
    const { server } = this.polly;
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a5/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a5/en/drafts/tripod/sitemap.xml')
      .intercept((_, res) => res.status(404).send());

    server
      .post('https://login.windows.net/common/oauth2/token?api-version=1.0')
      .intercept((_, res) => res.status(200).json({
        token_type: 'Bearer',
        refresh_token: 'dummy',
        access_token: 'dummy',
        expires_in: 81000,
      }));

    server
      .get('https://graph.microsoft.com/v1.0/shares/u!aHR0cHM6Ly9hZG9iZS5zaGFyZXBvaW50LmNvbS9zaXRlcy9UaGVCbG9nL1NoYXJlZCUyMERvY3VtZW50cy90aGVibG9n/driveItem')
      .intercept((_, res) => res.status(200).json({
        id: 'folderId',
        parentReference: {
          driveId: 'driveid',
        },
      }));

    server
      .get('https://graph.microsoft.com/v1.0/drives/driveid/items/folderId:/en/drafts/tripod:/children')
      .intercept((_, res) => res.status(400).send('some error'));

    const result = await index({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'cb8a0dc5d9d89b800835166783e4130451d3c6a5',
      path: '/en/drafts/tripod/sitemap.xml',
    }, DUMMY_ENV);

    assert.equal(result.statusCode, 400);
  }).timeout(5000);

  it('sends 500 for internal errors with onedrive', async function okOnedrive() {
    const { server } = this.polly;
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a5/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a5/en/drafts/tripod/sitemap.xml')
      .intercept((_, res) => res.status(404).send());
    const result = await index({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'cb8a0dc5d9d89b800835166783e4130451d3c6a5',
      path: '/en/drafts/tripod/sitemap.xml',
    }, { });

    assert.equal(result.statusCode, 500);
  }).timeout(5000);

  it('Retrieves Sitemap from github before onedrive', async function okOnedrive() {
    const sitemap = await readFile(path.resolve(__dirname, 'fixtures/sitemap.xml'), 'utf-8');

    const { server } = this.polly;
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a5/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a5/en/drafts/tripod/sitemap.xml')
      .intercept((_, res) => res.status(200).send(sitemap));

    const result = await index({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'cb8a0dc5d9d89b800835166783e4130451d3c6a5',
      path: '/en/drafts/tripod/sitemap.xml',
    }, DUMMY_ENV);

    assert.equal(result.statusCode, 200);
    assert.ok(result.body.indexOf('<loc>https://blog.adobe.com/en/publish/2021/02/23/advocates-family-life.html</loc>') > 0);
    assert.equal(result.headers['x-source-location'], 'https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a5/en/drafts/tripod/sitemap.xml');
    assert.equal(result.headers['surrogate-control'], 'max-age=30758400, stale-while-revalidate=30758400, stale-if-error=30758400, immutable');
    assert.equal(result.headers.vary, 'x-ow-version-lock');
  }).timeout(5000);
});
