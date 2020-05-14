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
const URL = require('url');
const { fetch } = require('@adobe/helix-fetch').context({
  httpsProtocols: process.env.FORCE_HTTP1 ? ['http1'] : ['http2', 'http1'],
});
const { utils } = require('@adobe/helix-shared');

async function handle(mp, owner, repo, ref, _, log, options) {
  const url = new URL('https://adobeioruntime.net/api/v1/web/helix/helix-services/word2md@v1');
  url.searchParams.append('path', mp.relPath);
  url.searchParams.append('rootId'.mp.id);

  url.searchParams.append('rid', options.requestId);
  url.searchParams.append('src', `${owner}/${repo}/${ref}`);

  const fetchopts = options;
  delete fetchopts.requestId;

  const response = await fetch(url.href, fetchopts);
  if (response.ok) {
    return {
      body: await response.text(),
      statusCode: 200,
      headers: {
        'x-source-location': response.headers.get('x-source-location'),
      },
    };
  }
  log[utils.logLevelForStatusCode(response.status)](`Unable to fetch ${url.href} (${response.status}) from word2md:`, await response.text());
  return {
    statusCode: utils.propagateStatusCode(response.statusCode),
    body: await response.text(),
  };
}

function canhandle(mp) {
  return mp && mp.type === 'onedrive';
}

module.exports = { canhandle, handle };
