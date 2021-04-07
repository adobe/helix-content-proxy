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
const { Response } = require('@adobe/helix-fetch');
const { utils } = require('@adobe/helix-shared');
const { fetch, getFetchOptions, errorResponse } = require('./utils');
const cache = require('./cache.js');

async function computeGithubURI(root, owner, repo, ref = 'main', path) {
  const url = new URL(root);
  const rootPath = url.pathname;

  // remove double slashes
  url.pathname = `${rootPath}/${owner}/${repo}/${ref}/${path}`
    .replace(/\/+/g, '/');
  return url.href;
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
  const response = await fetch(await computeGithubURI(root, owner, repo, ref, 'fstab.yaml'), getFetchOptions(options));
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
 * @param {string} opts.githubRootPath base URL for raw.githubusercontent.com
 * @param {string} opts.owner GitHub owner or org
 * @param {string} opts.repo GitHub repository
 * @param {string} opts.ref GitHub ref
 * @param {object} opts.log Helix-Log instance
 * @param {object} opts.options HTTP fetch options
 */
async function handle(opts) {
  const {
    mp, githubRootPath, owner, repo, ref, path, log, options,
  } = opts;
  const uri = mp
    ? await computeGithubURI(githubRootPath, mp.owner, mp.repo, mp.ref, `${(mp.basePath || '') + mp.relPath}.md`)
    : await computeGithubURI(githubRootPath, owner, repo, ref, path);
  const response = await fetch(uri, getFetchOptions(options));
  const body = await response.text();
  if (response.ok) {
    const immutable = isImmutable(ref);
    const headers = {
      'content-type': response.headers.get('content-type'),
      'x-source-location': uri,
      // cache for Runtime (non-flushable)
      'cache-control': 'no-store, private',
      'surrogate-key': utils.computeSurrogateKey(uri),
      'surrogate-control': immutable ? 'max-age=30758400, stale-while-revalidate=30758400, stale-if-error=30758400, immutable' : 'max-age=60',
    };

    return new Response(body, {
      status: 200,
      headers,
    });
  }
  return errorResponse(log, -response.status, `Unable to fetch ${uri} (${response.status}) from GitHub`);
}

function canhandle(mp) {
  // only handle non-existing mount points
  return !mp || mp.type === 'github';
}

module.exports = { canhandle, handle, fetchFSTab: fetchFSTabCached };
