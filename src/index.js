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
const { wrap } = require('@adobe/openwhisk-action-utils');
const { logger } = require('@adobe/openwhisk-action-logger');
const { wrap: status } = require('@adobe/helix-status');
const { epsagon } = require('@adobe/helix-epsagon');
const { TimeoutError } = require('@adobe/helix-fetch');
const { MountConfig } = require('@adobe/helix-shared');
const { fetchFSTab } = require('./github');

const github = require('./github');
const google = require('./google');
const onedrive = require('./onedrive');

const DEFAULT_FORWARD_HEADERS = [
  'x-request-id',
  'x-cdn-request-id',
  'x-cdn-url',
];

const HANDLERS = [
  github, google, onedrive,
];

/**
 * Retrieves content from a content repository
 * @param {string} owner github org or username
 * @param {string} repo repository name
 * @param {string} ref branch or tag name
 * @param {string} path file path
 * @returns {object} a greeting
 */
async function main({
  owner, repo, ref, path,
  REPO_RAW_ROOT, HTTP_TIMEOUT, GITHUB_TOKEN,
  __ow_headers: originalHeaders = {}, __ow_logger: log,
}) {
  if (!(owner && repo && ref && path)) {
    return {
      statusCode: 400,
      body: 'owner, repo, ref, and path parameters are required',
    };
  }
  const gitHubToken = GITHUB_TOKEN || originalHeaders['x-github-token'];
  const githubRootPath = REPO_RAW_ROOT || 'https://raw.githubusercontent.com/';

  const githubOptions = {
    timeout: HTTP_TIMEOUT || 1000,
    headers: DEFAULT_FORWARD_HEADERS.reduce((headers, header) => {
      // copy whitelisted headers
      if (originalHeaders[header.toLocaleLowerCase()]) {
        // eslint-disable-next-line no-param-reassign
        headers[header.toLocaleLowerCase()] = originalHeaders[header.toLowerCase()];
      }
      return headers;
    }, {
      // pass on authorization token
      Authorization: gitHubToken ? `token ${gitHubToken}` : undefined,
    }),
  };

  const externalOptions = {
    timeout: HTTP_TIMEOUT ? HTTP_TIMEOUT * 10 : 10 * 1000,
    requestId: originalHeaders['x-request-id']
    || originalHeaders['x-cdn-request-id']
    || originalHeaders['x-openwhisk-activation-id']
    || '',
  };

  try {
    const fstab = await fetchFSTab({
      root: githubRootPath, owner, repo, ref, log, options: githubOptions,
    });
    const mount = await new MountConfig().withSource(fstab).init();

    // extract resource path w/o extension.
    // eg: /foo.bar/welcome.gift.md -> /foo.bar/welcome.gift
    const idxLastSlash = path.lastIndexOf('/');
    const idx = path.indexOf('.', idxLastSlash + 1);
    const resourcePath = path.substring(0, idx);

    // mountpoint
    const mp = mount.match(resourcePath);

    const handler = HANDLERS.find(({ canhandle }) => canhandle && canhandle(mp));

    if (!handler) {
      log.error(`No handler found for type ${mp.type} at path ${path} (${owner}/${repo})`);
      return {
        body: 'Invalid mount configuration',
        statusCode: 501, // not implemented
      };
    }

    return handler.handle({
      mp,
      githubRootPath,
      owner,
      repo,
      ref,
      path,
      log,
      options: mp ? externalOptions : githubOptions,
    });
  } catch (e) {
    if (e instanceof TimeoutError) {
      return {
        statusCode: 504,
        body: e.message,
      };
    }
    log.error('Unhandled error', e, e.stack);
    return {
      body: e.message,
      statusCode:
      /* istanbul ignore next */
      e.status || 500,
    };
  }
}

module.exports.main = wrap(main)
  .with(epsagon)
  .with(status)
  .with(logger.trace)
  .with(logger);
