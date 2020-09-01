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
const { utils } = require('@adobe/helix-shared');
const { handleJSON } = require('./google-json');
const { fetch, getFetchOptions } = require('./utils');

/**
 * Retrieves a file from OneDrive
 * @param {object} opts options
 * @param {object} opts.mp the mountpoint as defined by helix-shared
 * @param {string} opts.owner the GitHub org or username
 * @param {string} opts.repo the GitHub repository
 * @param {string} opts.ref the GitHub ref
 * @param {object} opts.log a Helix-Log instance
 * @param {object} opts.options Helix Fetch options
 * @param {VersionLock} opts.lock Version lock helper
 */
async function handle(opts) {
  const {
    mp, owner, repo, ref, log, options, lock,
  } = opts;
  const url = lock.createActionURL({
    name: 'gdocs2md@v1',
  });

  url.searchParams.append('path', mp.relPath);
  url.searchParams.append('rootId', mp.id);

  url.searchParams.append('rid', options.requestId);
  url.searchParams.append('src', `${owner}/${repo}/${ref}`);

  const response = await fetch(url.href, getFetchOptions(options));
  const body = await response.text();
  if (response.ok) {
    return {
      body,
      statusCode: 200,
      headers: {
        'content-type': 'text/plain',
        // if the backend does not provide a source location, use the URL
        'x-source-location': response.headers.get('x-source-location') || url.href,
        'surrogate-key': utils.computeSurrogateKey(response.headers.get('x-source-location') || url.href),
        // cache for Runtime (non-flushable) – 1 minute
        'cache-control': 'max-age=60',
        // cache for Fastly (flushable) – endless
        'surrogate-control': 'max-age=30758400, stale-while-revalidate=30758400, stale-if-error=30758400, immutable',
      },
    };
  }
  log[utils.logLevelForStatusCode(response.status)](`Unable to fetch ${url.href} (${response.status}) from gdocs2md`);
  return {
    statusCode: utils.propagateStatusCode(response.status),
    body,
    headers: {
      'cache-control': 'max-age=60',
    },
  };
}

function canhandle(mp) {
  return mp && mp.type === 'google';
}

module.exports = { canhandle, handle, handleJSON };
