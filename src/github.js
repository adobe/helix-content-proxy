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
  httpsProtocols:
  /* istanbul ignore next */
  process.env.FORCE_HTTP1 ? ['http1'] : ['http2', 'http1'],
});
const { utils } = require('@adobe/helix-shared');

function computeGithubURI(root, owner, repo, ref, path) {
  const rootURI = URL.parse(root);
  const rootPath = rootURI.path;
  // remove double slashes
  const fullPath = `${rootPath}/${owner}/${repo}/${ref}/${path}`.replace(
    /\/+/g,
    '/',
  );

  rootURI.pathname = fullPath;

  return URL.format(rootURI);
}

async function fetchFSTab(root, owner, repo, ref, log, options) {
  const response = await fetch(computeGithubURI(root, owner, repo, ref, 'fstab.yaml'), options);
  if (response.ok) {
    return response.text();
  } else if (response.status === 404) {
    log.info(`No fstab.yaml found in repo ${owner}/${repo}`);
    return '';
  }
  log[utils.logLevelForStatusCode(response.status)](`Invalid response (${response.status}) when fetching fstab for ${owner}/${repo}`);
  const err = new Error('Unable to fetch fstab', await response.text());
  err.status = utils.propagateStatusCode(response.status);
  throw err;
}

function isimmutable(ref) {
  return ref && ref.match(/^[a-f0-9]{40}$/i);
}

async function handle({
  githubRootPath, owner, repo, ref, path, log, options,
}) {
  const uri = computeGithubURI(githubRootPath, owner, repo, ref, path);
  const response = await fetch(uri, options);
  if (response.ok) {
    return {
      statusCode: 200,
      body: await response.text(),
      headers: {
        'content-type': 'text/plain',
        'x-source-location': uri,
        'cache-control': isimmutable(ref) ? 'max-age=30758400' : 'max-age=60',
        'surrogate-control': isimmutable(ref) ? 'max-age=30758400, stale-while-revalidate=30758400, stale-if-error=30758400, immutable' : 'max-age=60',
      },
    };
  }
  log[utils.logLevelForStatusCode(response.status)](`Unable to fetch ${uri} (${response.status}) from GitHub`);
  return {
    statusCode: utils.propagateStatusCode(response.status),
    body: await response.text(),
  };
}

function canhandle(mp) {
  // only handle non-existing mount points
  return !mp;
}


module.exports = { canhandle, handle, fetchFSTab };
