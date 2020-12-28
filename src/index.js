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
const { Response } = require('node-fetch');
const { wrap, VersionLock } = require('@adobe/openwhisk-action-utils');
const { logger } = require('@adobe/openwhisk-action-logger');
const { wrap: helixStatus } = require('@adobe/helix-status');
const { AbortError } = require('@adobe/helix-fetch');
const { MountConfig } = require('@adobe/helix-shared');
const vary = require('./vary.js');
const { fetchFSTab } = require('./github');
const reverse = require('./reverse.js');
const lookupEditUrl = require('./lookup-edit-url.js');

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
 * @param {Request} req request object
 * @param {Context} context request context
 * @returns {Response} the response
 */
async function main(req, context) {
  const { env, log } = context;
  const {
    REPO_RAW_ROOT, HTTP_TIMEOUT, GITHUB_TOKEN, HTTP_TIMEOUT_EXTERNAL,
    GOOGLE_DOCS2MD_CLIENT_ID, GOOGLE_DOCS2MD_CLIENT_SECRET,
    GOOGLE_DOCS2MD_REFRESH_TOKEN,
    AZURE_WORD2MD_CLIENT_ID, AZURE_WORD2MD_CLIENT_SECRET,
    AZURE_HELIX_USER, AZURE_HELIX_PASSWORD,
  } = env;
  const { searchParams } = new URL(req.url);
  const params = Array.from(searchParams.entries()).reduce((p, [key, value]) => {
    // eslint-disable-next-line no-param-reassign
    p[key] = value;
    return p;
  }, {});
  const {
    owner, repo, ref, path,
    limit, offset, sheet, table,
  } = params;

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
  const gitHubToken = GITHUB_TOKEN || req.headers.get('x-github-token');
  const githubRootPath = REPO_RAW_ROOT || 'https://raw.githubusercontent.com/';
  // eslint-disable-next-line no-underscore-dangle
  const namespace = process.env.__OW_NAMESPACE || 'helix';
  const lock = new VersionLock(mainopts, {
    namespace,
    packageName: 'helix-services',
  });

  const qboptions = Object.entries(params)
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
      if (req.headers.has(header)) {
        // eslint-disable-next-line no-param-reassign
        headers[header.toLocaleLowerCase()] = req.headers.get(header);
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
    requestId: req.headers.get('x-request-id')
    || req.headers.get('x-cdn-request-id')
    || req.headers.get('x-openwhisk-activation-id')
    || '',
    namespace,
  };

  const dataOptions = {
    ...qboptions,
    'hlx_p.limit': limit,
    'hlx_p.offset': offset,
    sheet,
    table,
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

      if (params.lookup) {
        return reverse({
          mount,
          uri: new URL(params.lookup),
          prefix: params.prefix,
          owner,
          repo,
          ref,
          options: externalOptions,
          log,
          report: !!params.report,
        });
      }
      if (params.edit) {
        return lookupEditUrl({
          mount,
          uri: new URL(params.edit),
          options: externalOptions,
          owner,
          repo,
          ref,
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
      return new Response('Invalid mount configuration', {
        status: 501, // not implemented
      });
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
      return new Response(e.message, {
        status: 504,
      });
    }
    /* istanbul ignore next */
    const stack = (e && e.stack) || 'no stack';
    log.error('Unhandled error', e, stack);

    /* istanbul ignore next */
    const body = (e && e.message) || 'no message';
    /* istanbul ignore next */
    const status = (e && e.status) || 500;
    return new Response(body, { status });
  }
}

module.exports.main = wrap(main)
  .with(vary)
  .with(helixStatus)
  .with(logger.trace)
  .with(logger);
