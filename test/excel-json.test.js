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
/* eslint-disable global-require, class-methods-use-this, no-console */
const assert = require('assert');
const proxyquire = require('proxyquire');

class FakeOneDrive {
  getDriveItemFromShareLink() {
    return {
      '@odata.context':
    'https://graph.microsoft.com/v1.0/$metadata#shares(\'u%21aHR0cHM6Ly9hZG9iZS5zaGFyZXBvaW50LmNvbS9zaXRlcy9UaGVCbG9nL1NoYXJlZCUyMERvY3VtZW50cy9hZG1pbg%3D\')/driveItem/$entity',
      createdDateTime: '2020-02-10T18:21:43Z',
      eTag: '"{8EE52397-D2C5-498C-B917-4BFA92337E76},2"',
      id: '01DJQLOW4XEPSY5ROSRRE3SF2L7KJDG7TW',
      lastModifiedDateTime: '2020-02-10T18:21:43Z',
      name: 'admin',
      webUrl:
    'https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/admin',
      cTag: '"c:{8EE52397-D2C5-498C-B917-4BFA92337E76},0"',
      size: 895505630,
      parentReference:
    {
      driveId:
       'b!PpnkewKFAEaDTS6slvlVjh_3ih9lhEZMgYWwps6bPIWZMmLU5xGqS4uES8kIQZbH',
      driveType: 'documentLibrary',
      id: '01DJQLOW56Y2GOVW7725BZO354PWSELRRZ',
      path:
       '/drives/b!PpnkewKFAEaDTS6slvlVjh_3ih9lhEZMgYWwps6bPIWZMmLU5xGqS4uES8kIQZbH/root:',
    },
      fileSystemInfo:
    {
      createdDateTime: '2020-02-10T18:21:43Z',
      lastModifiedDateTime: '2020-02-10T18:21:43Z',
    },
      folder: { childCount: 5 },
      shared: { scope: 'users' },
    };
  }

  getDriveItem(_, path) {
    if (path.endsWith('missing.xlsx')) {
      const e = new Error('not found');
      e.statusCode = 404;
      throw e;
    }
    return {
      '@odata.context':
'https://graph.microsoft.com/v1.0/$metadata#drives(\'b%21PpnkewKFAEaDTS6slvlVjh_3ih9lhEZMgYWwps6bPIWZMmLU5xGqS4uES8kIQZbH\')/items/$entity',
      '@microsoft.graph.downloadUrl':
'https://adobe.sharepoint.com/sites/TheBlog/_layouts/15/download.aspx?UniqueId=28ee8cdd-211c-4b36-9f20-f2751134b342&Translate=false&tempauth=eyJ0eXAiOiJKV1QiLCJhbGciOiJub25lIn0.eyJhdWQiOiIwMDAwMDAwMy0wMDAwLTBmZjEtY2UwMC0wMDAwMDAwMDAwMDAvYWRvYmUuc2hhcmVwb2ludC5jb21AZmE3YjFiNWEtN2IzNC00Mzg3LTk0YWUtZDJjMTc4ZGVjZWUxIiwiaXNzIjoiMDAwMDAwMDMtMDAwMC0wZmYxLWNlMDAtMDAwMDAwMDAwMDAwIiwibmJmIjoiMTU5MTcxMTg5MSIsImV4cCI6IjE1OTE3MTU0OTEiLCJlbmRwb2ludHVybCI6Ind3NGZGaHlEanozdXlYVEFCZW1PZ3N1aXV5enQyS0V5OTlxYmhBREJQNzA9IiwiZW5kcG9pbnR1cmxMZW5ndGgiOiIxMzAiLCJpc2xvb3BiYWNrIjoiVHJ1ZSIsImNpZCI6IllqY3daVE13T0dVdE9UTmlOaTAwWVRFeExXRTNabUl0TVdaaU9EWXhPVGxpTURSbSIsInZlciI6Imhhc2hlZHByb29mdG9rZW4iLCJzaXRlaWQiOiJOMkpsTkRrNU0yVXRPRFV3TWkwME5qQXdMVGd6TkdRdE1tVmhZemsyWmprMU5UaGwiLCJhcHBfZGlzcGxheW5hbWUiOiJIZWxpeCBkb2MybWFya2Rvd24gc2VydmljZSIsImdpdmVuX25hbWUiOiJQcm9qZWN0IiwiZmFtaWx5X25hbWUiOiJIZWxpeCBJbnRlZ3JhdGlvbiIsImFwcGlkIjoiODNhYjI5MjItNWYxMS00ZTRkLTk2ZjMtZDFlMGZmMTUyODU2IiwidGlkIjoiZmE3YjFiNWEtN2IzNC00Mzg3LTk0YWUtZDJjMTc4ZGVjZWUxIiwidXBuIjoiaGVsaXhAYWRvYmUuY29tIiwicHVpZCI6IjEwMDMyMDAwN0RFMTQ3NkIiLCJjYWNoZWtleSI6IjBoLmZ8bWVtYmVyc2hpcHwxMDAzMjAwMDdkZTE0NzZiQGxpdmUuY29tIiwic2NwIjoiYWxsZmlsZXMud3JpdGUgbXlmaWxlcy5yZWFkIGFsbHNpdGVzLndyaXRlIGFsbHByb2ZpbGVzLnJlYWQiLCJ0dCI6IjIiLCJ1c2VQZXJzaXN0ZW50Q29va2llIjpudWxsfQ.NkpwZTdmZXZIbjA2NXV1Z00weTBrb2RqcldGdmFMWG9rYjNVWVA2R3BSRT0&ApiVersion=2.0',
      createdDateTime: '2020-05-11T14:48:27Z',
      eTag: '"{28EE8CDD-211C-4B36-9F20-F2751134B342},109"',
      id: '01DJQLOW65RTXCQHBBGZFZ6IHSOUITJM2C',
      lastModifiedDateTime: '2020-06-03T08:00:23Z',
      name: 'urls.xlsx',
      webUrl:
'https://adobe.sharepoint.com/sites/TheBlog/_layouts/15/Doc.aspx?sourcedoc=%7B28EE8CDD-211C-4B36-9F20-F2751134B342%7D&file=urls.xlsx&action=default&mobileredirect=true',
      cTag: '"c:{28EE8CDD-211C-4B36-9F20-F2751134B342},110"',
      size: 306302,
      parentReference:
{
  driveId:
   'b!PpnkewKFAEaDTS6slvlVjh_3ih9lhEZMgYWwps6bPIWZMmLU5xGqS4uES8kIQZbH',
  driveType: 'documentLibrary',
  id: '01DJQLOW2TC5HJIZTSINCYVCXDAURGV7F4',
  path:
   '/drives/b!PpnkewKFAEaDTS6slvlVjh_3ih9lhEZMgYWwps6bPIWZMmLU5xGqS4uES8kIQZbH/root:/admin/importer',
},
      file:
{
  mimeType:
   'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  hashes: { quickXorHash: 'PvHXZY+JGybdCgGNHsa0tReqqZk=' },
},
      fileSystemInfo:
{
  createdDateTime: '2020-05-11T14:48:27Z',
  lastModifiedDateTime: '2020-06-03T08:00:23Z',
},
    };
  }
}

describe('Excel JSON Integration tests', () => {
  it('Do not get sharelink from path with invalid credentials', async () => {
    const { handleJSON } = require('../src/excel-json');

    const res = await handleJSON({
      mp: {
        url: 'https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/admin',
        relPath: '/importer/urls',
      },
      log: {
        debug: console.log,
        info: console.log,
        warn: console.log,
        error: console.log,
      },
      options: {

      },
    });

    assert.equal(res.statusCode, 500);
  }).timeout(50000);

  it('Get JSON', async () => {
    const { handleJSON } = proxyquire('../src/excel-json', {
      '@adobe/helix-onedrive-support': {
        OneDrive: FakeOneDrive,
      },
      '@adobe/helix-fetch': {
        fetch: () => ({
          ok: true,
          headers: new Map(),
          json: () => ([
            { foo: 1, bar: 2 },
          ]),
        }),
      },
    });

    const res = await handleJSON({
      mp: {
        url: 'https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/admin',
        relPath: '/importer/urls',
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
      },
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.headers, {
      'cache-control': undefined,
      'content-type': 'application/json',
      'surrogate-control': 'max-age=30758400, stale-while-revalidate=30758400, stale-if-error=30758400, immutable',
      'surrogate-key': 'uZNkzznjLFRdaoIc',
      'x-source-location': '/drives/b!PpnkewKFAEaDTS6slvlVjh_3ih9lhEZMgYWwps6bPIWZMmLU5xGqS4uES8kIQZbH/items/01DJQLOW65RTXCQHBBGZFZ6IHSOUITJM2C',
    });
    assert.ok(Array.isArray(res.body));
  }).timeout(50000);

  it('Get missing JSON', async () => {
    const { handleJSON } = proxyquire('../src/excel-json', {
      '@adobe/helix-onedrive-support': {
        OneDrive: FakeOneDrive,
      },
      '@adobe/helix-fetch': {
        fetch: () => ({
          ok: true,
          headers: new Map(),
          json: () => ([
            { foo: 1, bar: 2 },
          ]),
        }),
      },
    });

    const res = await handleJSON({
      mp: {
        url: 'https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/admin',
        relPath: '/importer/missing',
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
      },
    });

    assert.equal(res.statusCode, 404);
  }).timeout(50000);

  it('Get bad JSON', async () => {
    const { handleJSON } = proxyquire('../src/excel-json', {
      '@adobe/helix-onedrive-support': {
        OneDrive: FakeOneDrive,
      },
      '@adobe/helix-fetch': {
        fetch: () => ({
          ok: true,
          headers: new Map(),
          json: () => JSON.parse('not json'),
        }),
      },
    });

    const res = await handleJSON({
      mp: {
        url: 'https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/admin',
        relPath: '/importer/urls',
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
      },
    });

    assert.equal(res.statusCode, 502);
  }).timeout(50000);

  it('Get timeout', async () => {
    const { handleJSON } = proxyquire('../src/excel-json', {
      '@adobe/helix-onedrive-support': {
        OneDrive: FakeOneDrive,
      },
      '@adobe/helix-fetch': {
        fetch: () => ({
          ok: false,
          status: 504,
          headers: new Map(),
          json: () => ([]),
        }),
      },
    });

    const res = await handleJSON({
      mp: {
        url: 'https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/admin',
        relPath: '/importer/urls',
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
      },
    });

    assert.equal(res.statusCode, 504);
  }).timeout(50000);
});
