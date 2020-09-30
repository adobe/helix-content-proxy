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
const { wrap, VersionLock } = require('@adobe/openwhisk-action-utils');
const { logger } = require('@adobe/openwhisk-action-logger');
const { wrap: status } = require('@adobe/helix-status');
const { epsagon } = require('@adobe/helix-epsagon');
const { AbortError } = require('@adobe/helix-fetch');
const { MountConfig } = require('@adobe/helix-shared');
const { fetchFSTab } = require('./github');
const reverse = require('./reverse.js');

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
 * @param {string} mainopts.owner github org or username
 * @param {string} mainopts.repo repository name
 * @param {string} mainopts.ref branch or tag name
 * @param {string} mainopts.path file path
 * @returns {object} a greeting
 */
async function main(mainopts) {
  const {
    owner, repo, ref, path,
    REPO_RAW_ROOT, HTTP_TIMEOUT, GITHUB_TOKEN, HTTP_TIMEOUT_EXTERNAL,
    GOOGLE_DOCS2MD_CLIENT_ID, GOOGLE_DOCS2MD_CLIENT_SECRET,
    GOOGLE_DOCS2MD_REFRESH_TOKEN,
    AZURE_WORD2MD_CLIENT_ID, AZURE_WORD2MD_CLIENT_SECRET,
    AZURE_HELIX_USER, AZURE_HELIX_PASSWORD,
    __ow_headers: originalHeaders = {}, __ow_logger: log,
    limit, offset,
  } = mainopts;
  if (!(owner && repo && ref && path)) {
    return {
      statusCode: 400,
      body: 'owner, repo, ref, and path parameters are required',
    };
  }
  // validate path parameter
  if (path.indexOf('//') > -1) {
    return {
      statusCode: 404,
      body: `invalid path: ${path}`,
    };
  }
  const gitHubToken = GITHUB_TOKEN || originalHeaders['x-github-token'];
  const githubRootPath = REPO_RAW_ROOT || 'https://raw.githubusercontent.com/';
  // eslint-disable-next-line no-underscore-dangle
  const namespace = process.env.__OW_NAMESPACE || 'helix';
  const lock = new VersionLock(mainopts, {
    namespace,
    packageName: 'helix-services',
  });

  const qboptions = Object.entries(mainopts)
    .filter(([key]) => key.startsWith('hlx_'))
    .reduce((p, [key, value]) => {
      // eslint-disable-next-line no-param-reassign
      p[key] = value;
      return p;
    }, {});

  const githubOptions = {
    cache: 'no-store',
    fetchTimeout: HTTP_TIMEOUT || 1000,
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
    GOOGLE_DOCS2MD_CLIENT_ID,
    GOOGLE_DOCS2MD_CLIENT_SECRET,
    GOOGLE_DOCS2MD_REFRESH_TOKEN,
    AZURE_WORD2MD_CLIENT_ID,
    AZURE_WORD2MD_CLIENT_SECRET,
    AZURE_HELIX_USER,
    AZURE_HELIX_PASSWORD,
    cache: 'no-store',
    fetchTimeout: HTTP_TIMEOUT_EXTERNAL || 20000,
    requestId: originalHeaders['x-request-id']
    || originalHeaders['x-cdn-request-id']
    || originalHeaders['x-openwhisk-activation-id']
    || '',
    namespace,
  };

  const dataOptions = {
    ...qboptions,
    'hlx_p.limit': limit,
    'hlx_p.offset': offset,
  };

  try {
    let handler;
    let mp;

    // ignore externals for some well known github files
    if (['/head.md', '/header.md', '/footer.md'].indexOf(path) >= 0) {
      handler = github;
    } else {
      const fstab = await fetchFSTab({
        root: githubRootPath, owner, repo, ref, log, options: githubOptions,
      });
      const mount = await new MountConfig().withSource(fstab).init();

      if (mainopts.lookup) {
        return reverse({
          mount,
          uri: new URL(mainopts.lookup),
          prefix: mainopts.prefix,
          owner,
          repo,
          ref,
          options: externalOptions,
          log,
        });
      }

      // extract resource path w/o extension.
      // eg: /foo.bar/welcome.gift.md -> /foo.bar/welcome.gift
      const idxLastSlash = path.lastIndexOf('/');
      const idx = path.indexOf('.', idxLastSlash + 1);
      const resourcePath = path.substring(0, idx);

      // mountpoint
      mp = mount.match(resourcePath);
      handler = HANDLERS.find(({ canhandle }) => canhandle && canhandle(mp));
    }

    if (!handler) {
      log.error(`No handler found for type ${mp.type} at path ${path} (${owner}/${repo})`);
      return {
        body: 'Invalid mount configuration',
        statusCode: 501, // not implemented
      };
    }

    if (path.endsWith('.json') && handler.handleJSON) {
      return await handler.handleJSON({
        mp,
        githubRootPath,
        owner,
        repo,
        ref,
        path,
        log,
        lock,
        options: externalOptions,
      }, dataOptions);
    }

    return await handler.handle({
      mp,
      githubRootPath,
      owner,
      repo,
      ref,
      path,
      log,
      lock,
      options: mp ? externalOptions : githubOptions,
    });
  } catch (e) {
    if (e instanceof AbortError) {
      return {
        statusCode: 504,
        body: e.message,
      };
    }
    log.error('Unhandled error', e,
    /* istanbul ignore next */
      (e && e.stack) || 'no stack');
    return {
      body:
      /* istanbul ignore next */
      (e && e.message) || 'no message',
      statusCode:
      /* istanbul ignore next */
      (e && e.status) || 500,
    };
  }
}

module.exports.main = wrap(main)
  .with(epsagon)
  .with(status)
  .with(logger.trace)
  .with(logger);
