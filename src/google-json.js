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
const { Response } = require('@adobe/helix-universal');
const utils = require('@adobe/helix-shared-utils');
const {
  appendURLParams, fetch, getFetchOptions, errorResponse,
} = require('./utils');
const { getIdFromPath } = require('./google-helpers.js');

/**
 * Fetches an google sheet from the external source.
 * @param {ExternalHandlerOptions} opts the options.
 * @param {object} params original request params
 * @returns {Promise<Response>} a http response
 */
async function handleJSON(opts, params) {
  const {
    mp, log, options, resolver,
  } = opts;

  // if (options.credentials) {
  //   // todo: respect credentials
  // }

  try {
    const sheetId = await getIdFromPath(mp.relPath.substring(1), mp.id, log, options);

    if (!sheetId) {
      return errorResponse(log, 404, 'spreadsheet not found');
    }

    const sheetURL = `https://docs.google.com/spreadsheets/d/${sheetId}/view`;
    const actionUrl = resolver.createURL({
      package: 'helix-services',
      name: 'data-embed',
      version: 'v3',
    });
    const url = appendURLParams(actionUrl, {
      ...params,
      src: sheetURL,
    });

    const fopts = getFetchOptions(options);
    fopts.headers['cache-control'] = 'no-cache'; // respected by runtime

    const response = await fetch(url, fopts);
    const body = await response.text();
    if (response.ok) {
      // if the backend does not provide a source location, use the sheetId
      const sourceLocation = response.headers.get('x-source-location') || sheetId;
      return new Response(body, {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-source-location': sourceLocation,
          'surrogate-key': utils.computeSurrogateKey(sourceLocation),
          // cache for Runtime (non-flushable)
          'cache-control': 'no-store, private',
          // cache for Fastly (flushable) – endless
          'surrogate-control': 'max-age=30758400, stale-while-revalidate=30758400, stale-if-error=30758400, immutable',
        },
      });
    }
    return errorResponse(log, -response.status,
      `Unable to fetch ${url} (${response.status}) from gdocs2md`, '', 'max-age=60');
  } catch (e) {
    return errorResponse(log, 502, `error fetching data: ${e.message} (${e.code})`);
  }
}

module.exports = { handleJSON };
