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
const { appendURLParams, fetch, getFetchOptions } = require('./utils');
const { getIdFromPath } = require('./google-helpers.js');

async function handleJSON(opts, params) {
  const {
    mp, log, options, lock,
  } = opts;

  try {
    const sheetId = await getIdFromPath(mp.relPath.substring(1), mp.id, log, options);

    if (!sheetId) {
      return {
        statusCode: 404,
        body: 'spreadsheet not found',
        headers: {
          'cache-control': 'no-store, private, must-revalidate',
        },
      };
    }

    const sheetURL = `https://docs.google.com/spreadsheets/d/${sheetId}/view`;
    const actionUrl = lock.createActionURL({
      name: 'data-embed@v1',
    });
    const url = appendURLParams(actionUrl, {
      ...params,
      src: sheetURL,
    });

    const fopts = getFetchOptions(options);
    fopts.headers['cache-control'] = 'no-cache'; // respected by runtime

    const response = await fetch(url, fopts);
    const body = await response.json();
    if (response.ok) {
      // if the backend does not provide a source location, use the sheetId
      const sourceLocation = response.headers.get('x-source-location') || sheetId;
      return {
        body,
        statusCode: 200,
        headers: {
          'content-type': 'application/json',
          'x-source-location': sourceLocation,
          'surrogate-key': utils.computeSurrogateKey(sourceLocation),
          // cache for Runtime (non-flushable)
          'cache-control': 'no-store, private, must-revalidate',
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
    log.error(`error fetching data: ${e.message} (${e.code})`);
    return {
      body: '',
      statusCode: 502, // no JSON = bad gateway
      headers: {
        'content-type': 'text/plain',
        // cache for Runtime (non-flushable)
        'cache-control': 'no-store, private, must-revalidate',
      },
    };
  }
}

module.exports = { handleJSON };
