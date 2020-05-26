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
const cache = require('./cache');

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

/**
 * Fetches an FSTab file from a GitHub repository
 * @param {object} opts options
 * @param {string} opts.root base URL for GitHub
 * @param {string} opts.owner GitHub owner or org
 * @param {string} opts.repo GitHub repository
 * @param {string} opts.ref GitHub ref
 * @param {object} opts.log Helix-Log instance
 * @param {object} opts.options HTTP request options
 */
async function fetchFSTabUncached(opts) {
  const {
    root, owner, repo, ref, log, options,
  } = opts;
  const response = await fetch(computeGithubURI(root, owner, repo, ref, 'fstab.yaml'), options);
  const text = await response.text();
  if (response.ok) {
    return text;
  } else if (response.status === 404) {
    log.info(`No fstab.yaml found in repo ${owner}/${repo}, ${text}`);
    return '';
  }
  log[utils.logLevelForStatusCode(response.status)](`Invalid response (${response.status}) when fetching fstab for ${owner}/${repo}`);
  const err = new Error('Unable to fetch fstab', text);
  err.status = utils.propagateStatusCode(response.status);
  throw err;
}

// keep it cachy.
const fetchFSTabCached = cache(fetchFSTabUncached, {
  hash: (fn, {
    owner, repo, ref, _, options,
  }) => ([
    fn.name,
    owner,
    repo,
    ref,
    options && options.headers && options.headers.Authorization
      ? options.headers.Authorization : undefined,
  ].join()),
});

function isImmutable(ref) {
  return ref && ref.match(/^[a-f0-9]{40}$/i);
}

/**
 * Retrieves a file from GitHub
 * @param {object} opts
 * @param {string} githubRootPath base URL for raw.githubusercontent.com
 * @param {string} owner GitHub owner or org
 * @param {string} repo GitHub repository
 * @param {string} ref GitHub ref
 * @param {object} log Helix-Log instance
 * @param {object} options HTTP fetch options
 */
async function handle(opts) {
  const {
    githubRootPath, owner, repo, ref, path, log, options,
  } = opts;
  const uri = computeGithubURI(githubRootPath, owner, repo, ref, path);
  const response = await fetch(uri, options);
  const body = await response.text();
  if (response.ok) {
    const immutable = isImmutable(ref);
    return {
      statusCode: 200,
      body,
      headers: {
        'content-type': 'text/plain',
        'x-source-location': uri,
        'cache-control': immutable ? 'max-age=30758400' : 'max-age=60',
        'surrogate-control': immutable ? 'max-age=30758400, stale-while-revalidate=30758400, stale-if-error=30758400, immutable' : 'max-age=60',
      },
    };
  }
  log[utils.logLevelForStatusCode(response.status)](`Unable to fetch ${uri} (${response.status}) from GitHub`);
  return {
    statusCode: utils.propagateStatusCode(response.status),
    body,
  };
}

function canhandle(mp) {
  // only handle non-existing mount points
  return !mp;
}


module.exports = { canhandle, handle, fetchFSTab: fetchFSTabCached };
