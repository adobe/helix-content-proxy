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
/* eslint-disable no-param-reassign */

process.env.HELIX_FETCH_FORCE_HTTP1 = 'true';

const assert = require('assert');
const z = require('zlib');
const { main } = require('../src/index.js');
const cache = require('../src/cache.js');

const { setupPolly } = require('./utils.js');

require('dotenv').config();

const fstab = `
mountpoints:
  /ms: https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/theblog
  /gdocs: https://drive.google.com/drive/u/0/folders/1DS-ZKyRuwZkMPIDeuKxNMQnKDrcw1_aw
`;

const DEFAULT_PARAMS = {
  owner: 'adobe',
  repo: 'theblog',
  ref: 'master',
  path: '/',
  GOOGLE_DOCS2MD_CLIENT_ID: process.env.GOOGLE_DOCS2MD_CLIENT_ID || 'fake',
  GOOGLE_DOCS2MD_CLIENT_SECRET: process.env.GOOGLE_DOCS2MD_CLIENT_SECRET || 'fake',
  GOOGLE_DOCS2MD_REFRESH_TOKEN: process.env.GOOGLE_DOCS2MD_REFRESH_TOKEN || 'fake',
};

function scramble(server) {
  server.any().on('beforePersist', (_, recording) => {
    recording.request.headers = recording.request.headers.filter(({ name }) => name !== 'authorization');
    delete recording.request.postData;

    if (recording.request.url === 'https://oauth2.googleapis.com/token') {
      const val = JSON.parse(z.gunzipSync(Buffer.from(JSON.parse(recording.response.content.text).join(''), 'hex')));
      val.access_token = val.access_token
        .replace(/[A-Z]/g, 'A')
        .replace(/[0-9]/g, '0')
        .replace(/[a-z]/g, 'a');

      const buf = JSON.stringify([z.gzipSync(Buffer.from(JSON.stringify(val), 'utf8')).toString('hex')]);
      recording.response.content.text = buf;
    }
  });
}

describe('Google Edit Link Tests', () => {
  before(() => {
    // clear cache for tests
    cache.options({ maxSize: 1000 });
  });

  setupPolly({
    recordIfMissing: true,
    matchRequestsBy: {
      method: true,
      headers: false,
      body: false,
      order: false,
      url: {
        protocol: true,
        username: false,
        password: false,
        hostname: true,
        port: false,
        pathname: true,
        query: true,
        hash: true,
      },
    },
  });

  it('Returns redirect for google based page', async function test() {
    const { server } = this.polly;
    scramble(server);

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      ...DEFAULT_PARAMS,
      edit: 'https://pages.adobe.com/gdocs/creativecloud/en/ete/how-adobe-apps-work-together/index.html',
    });

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://docs.google.com/document/d/14351arsFQspbpbwYXhOPQsogHm9aTXFGHnIM1lviG5Q/edit');
  }).timeout(50000);

});
