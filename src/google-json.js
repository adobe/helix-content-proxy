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
const { google } = require('googleapis');

const { fetch } = require('@adobe/helix-fetch').context({
  httpsProtocols:
  /* istanbul ignore next */
  process.env.HELIX_FETCH_FORCE_HTTP1 ? ['http1'] : ['http2', 'http1'],
});
const { utils } = require('@adobe/helix-shared');
const cache = require('./cache');
const { appendURLParams } = require('./utils');

/**
 * Remember the access token for future action invocations.
 */
let tokenCache = {};

function createOAuthClient(options, creds) {
  const oAuth2Client = new google.auth.OAuth2(options);
  oAuth2Client.setCredentials({
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    ...tokenCache,
    ...creds,
  });
  oAuth2Client.on('tokens', (tokens) => {
    tokenCache = tokens;
  });

  return oAuth2Client;
}

const createCachedOAuthClient = cache(createOAuthClient);

async function getUncachedIdFromPath(path, parentId, log, options) {
  const {
    GOOGLE_DOCS2MD_CLIENT_ID: clientId,
    GOOGLE_DOCS2MD_CLIENT_SECRET: clientSecret,
    // eslint-disable-next-line camelcase
    GOOGLE_DOCS2MD_REFRESH_TOKEN: refresh_token,
  } = options;

  const auth = await createCachedOAuthClient({ clientId, clientSecret }, { refresh_token });

  const drive = google.drive({
    version: 'v3',
    auth,
  });

  const [name, ...rest] = path.split('/');

  const query = [
    `'${parentId}' in parents`,
    `and name = ${JSON.stringify(name)}`,
    'and trashed=false',
    // folder if path continues, sheet otherwise
    `and mimeType = '${rest.length ? 'application/vnd.google-apps.folder' : 'application/vnd.google-apps.spreadsheet'}'`].join(' ');
  log.debug(query);

  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });

  const [item] = res && res.data && res.data.files && res.data.files.length
    ? res.data.files : [];

  if (item && rest.length) {
    // eslint-disable-next-line no-use-before-define
    return getIdFromPath(rest.join('/'), item.id, log, options);
  } else if (item) {
    return item.id;
  }
  return null;
}

const getIdFromPath = cache(getUncachedIdFromPath);

async function handleJSON(opts, params) {
  const {
    mp, log, options,
  } = opts;

  const { namespace } = options;

  const sheetId = await getIdFromPath(mp.relPath.substring(1), mp.id, log, options);

  if (!sheetId) {
    return {
      statusCode: 404,
      body: 'spreadsheet not found',
      headers: {
        'cache-control': 'max-age=60',
      },
    };
  }

  const sheetURL = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
  const url = appendURLParams(`https://adobeioruntime.net/api/v1/web/${namespace}/helix-services/data-embed@v1/${sheetURL}`, params);

  try {
    const response = await fetch(url, options);

    const body = await response.json();
    if (response.ok) {
      return {
        body,
        statusCode: 200,
        headers: {
          'content-type': 'application/json',
          // if the backend does not provide a source location, use the URL
          'x-source-location': response.headers.get('x-source-location') || sheetURL,
          // cache for Runtime (non-flushable)
          'cache-control': response.headers.get('cache-control'),
          // cache for Fastly (flushable) – endless
          'surrogate-control': 'max-age=30758400, stale-while-revalidate=30758400, stale-if-error=30758400, immutable',
        },
      };
    }

    log[utils.logLevelForStatusCode(response.status)](`Unable to fetch ${url} (${response.status}) from gdocs2md`);
    return {
      statusCode: utils.propagateStatusCode(response.status),
      body,
      headers: {
        'cache-control': 'max-age=60',
      },
    };
  } catch (e) {
    log.error(e);
    return {
      body: e.toString(),
      statusCode: 502, // no JSON = bad gateway
      headers: {
        'content-type': 'text/plain',
        // if the backend does not provide a source location, use the URL
        'x-source-location': url,
        // cache for Runtime (non-flushable)
        'cache-control': 'max-age=60',
      },
    };
  }
}

module.exports = { handleJSON };
