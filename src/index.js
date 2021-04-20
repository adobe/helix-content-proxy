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
const { logger } = require('@adobe/helix-universal-logger');
const { wrap: helixStatus } = require('@adobe/helix-status');
const { AbortError, FetchError } = require('@adobe/helix-fetch');
const { wrap, MountConfig } = require('@adobe/helix-shared');
const vary = require('./vary.js');
const { fetchFSTab } = require('./github');
const reverse = require('./reverse.js');
const lookupEditUrl = require('./lookup-edit-url.js');
const { errorResponse, base64 } = require('./utils.js');

const github = require('./github');
const google = require('./google');
const onedrive = require('./onedrive');
const { getCredentials } = require('./credentials.js');

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
  const { env, log, resolver } = context;
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

  try {
    // keep lookup/edit backward compatible - remove eventually
    if (params.lookup) {
      params.path = `/hlx_${base64(params.lookup)}.lnk`;
    }
    if (params.edit) {
      params.path = `${new URL(params.edit).pathname}.lnk`;
    }

    const {
      owner, repo, ref, path,
      limit, offset, sheet, table,
    } = params;

    if (!(owner && repo && ref && path)) {
      return errorResponse(log, 400, '', 'owner, repo, ref, and path parameters are required');
    }
    // validate path parameter
    if (path.indexOf('//') > -1) {
      return errorResponse(log, 404, `invalid path: ${path}`, 'invalid path');
    }
    const gitHubToken = GITHUB_TOKEN || req.headers.get('x-github-token');
    const githubRootPath = REPO_RAW_ROOT || 'https://raw.githubusercontent.com/';
    // eslint-disable-next-line no-underscore-dangle
    const namespace = process.env.__OW_NAMESPACE || 'helix';

    const qboptions = Object.entries(params)
      .filter(([key]) => key.startsWith('hlx_'))
      .reduce((p, [key, value]) => {
        // eslint-disable-next-line no-param-reassign
        p[key] = value;
        return p;
      }, {});

    const githubOptions = {
      cache: 'no-store',
      fetchTimeout: HTTP_TIMEOUT || 5000,
      headers: DEFAULT_FORWARD_HEADERS.reduce((headers, header) => {
        // copy whitelisted headers
        if (req.headers.has(header)) {
          // eslint-disable-next-line no-param-reassign
          headers[header.toLocaleLowerCase()] = req.headers.get(header);
        }
        return headers;
      }, {}),
    };
    if (gitHubToken) {
      // pass on authorization token
      githubOptions.headers.authorization = `token ${gitHubToken}`;
    }

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
      gitHubToken,
    };

    const dataOptions = {
      ...qboptions,
      'hlx_p.limit': limit,
      'hlx_p.offset': offset,
      sheet,
      table,
    };

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

      // check for special `.lnk` extension
      if (path.endsWith('.lnk')) {
        // check if edit or lookup
        const name = path.split('/').pop();
        const match = /^hlx_([0-9a-zA-Z=-_]+).lnk$/.exec(name);
        if (match) {
          return reverse({
            mount,
            uri: new URL(Buffer.from(match[1], 'base64').toString('utf-8')),
            prefix: params.prefix,
            owner,
            repo,
            ref,
            options: externalOptions,
            log,
            report: !!params.report || !!params.hlx_report,
          });
        }

        return lookupEditUrl({
          mount,
          options: externalOptions,
          owner,
          repo,
          ref,
          path: path.substring(0, path.length - 4),
          log,
          report: !!params.report || !!params.hlx_report,
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
      return errorResponse(log, 501,
        `No handler found for type ${mp.type} at path ${path} (${owner}/${repo})`,
        'Invalid mount configuration');
    }

    // extract credentials
    if (gitHubToken && mp) {
      externalOptions.credentials = getCredentials(log, mp, gitHubToken);
    }

    if (path.match(/sitemap(-[^/]+)?\.xml$/) && handler.handleSitemapXML) {
      // be backward compatible, first check github
      const res = await github.handle({
        githubRootPath,
        owner,
        repo,
        ref,
        path,
        log,
        resolver,
        options: githubOptions,
      });
      if (res.status !== 404) {
        log.info(`deliver ${path} from github.`);
        return res;
      }

      return await handler.handleSitemapXML({
        mp,
        githubRootPath,
        owner,
        repo,
        ref,
        path,
        log,
        resolver,
        options: externalOptions,
      }, dataOptions);
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
        resolver,
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
      resolver,
      options: mp ? externalOptions : githubOptions,
    });
  } catch (e) {
    if (e instanceof AbortError) {
      return errorResponse(log, 504, e.message);
    }
    /* istanbul ignore next */
    if (e instanceof FetchError) {
      if (e.code === 'ECONNRESET') {
        // connection reset by host: temporary network issue
        return errorResponse(log, 504, e.message);
      }
    }
    if (e instanceof TypeError) {
      /* istanbul ignore next */
      if (e.code === 'ERR_INVALID_URL') {
        e.status = 400;
      }
    }

    /* istanbul ignore next */
    const stack = (e && e.stack) || 'no stack';
    log.error('Unhandled error', e, stack);

    /* istanbul ignore next */
    const message = (e && e.message) || 'no message';
    /* istanbul ignore next */
    const status = (e && e.status) || 500;

    return errorResponse(null, status, message);
  }
}

module.exports.main = wrap(main)
  .with(vary)
  .with(helixStatus)
  .with(logger.trace)
  .with(logger);
