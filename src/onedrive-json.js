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

const { OneDrive } = require('@adobe/helix-onedrive-support');
const utils = require('@adobe/helix-shared-utils');
const { Response } = require('@adobe/helix-universal');
const { AbortError } = require('@adobe/helix-fetch');
const { getOneDriveClient, getAccessToken } = require('./onedrive-helpers.js');
const {
  appendURLParams, fetch, getFetchOptions, errorResponse,
} = require('./utils');

/**
 * Fetches an excel sheet from the external source.
 * @param {ExternalHandlerOptions} opts the options.
 * @param {object} params original request params
 * @returns {Promise<Response>} a http response
 */
async function handleJSON(opts, params) {
  const {
    mp, log, options, resolver,
  } = opts;

  try {
    const drive = await getOneDriveClient(opts);

    log.debug(`resolving sharelink to ${mp.url}`);
    const rootItem = await drive.getDriveItemFromShareLink(mp.url);
    log.debug(`retrieving item-id for ${mp.relPath}.xlsx`);
    const [item] = await drive.fuzzyGetDriveItem(rootItem, encodeURI(`${mp.relPath}.xlsx`));
    if (!item) {
      const error = new Error('Not found');
      error.statusCode = 404;
      throw error;
    }
    const itemUri = OneDrive.driveItemToURL(item);
    const actionUrl = resolver.createURL({
      package: 'helix-services',
      name: 'data-embed',
      version: 'v3',
    });
    const url = appendURLParams(actionUrl, {
      ...params,
      src: itemUri.toString(),
    });

    try {
      log.debug(`fetching data from ${url}`);

      const fopts = getFetchOptions(options);
      fopts.headers['cache-control'] = 'no-cache'; // respected by runtime
      const accessToken = await getAccessToken(drive);
      if (accessToken) {
        fopts.headers.authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch(url, fopts);
      const sourceLocation = response.headers.get('x-source-location') || itemUri.pathname;
      const body = await response.text();
      if (response.ok) {
        const headers = {
          'content-type': 'application/json',
          // if the backend does not provide a source location, use the URL
          'x-source-location': sourceLocation,
          // enable fine-grained cache invalidation
          'surrogate-key': utils.computeSurrogateKey(sourceLocation),
          // cache for Runtime (non-flushable)
          'cache-control': 'no-store, private',
          // cache for Fastly (flushable) – endless
          'surrogate-control': 'max-age=30758400, stale-while-revalidate=30758400, stale-if-error=30758400, immutable',
        };
        const lastModified = response.headers.get('last-modified');
        if (lastModified) {
          headers['last-modified'] = lastModified;
        }
        // ensure json
        JSON.parse(body);
        return new Response(body, {
          status: 200,
          headers,
        });
      }

      return errorResponse(
        log,
        -response.status,
        `Unable to fetch ${url} (${response.status}) from data-embed`,
        '',
        'max-age=60',
      );
    } catch (gatewayerror) {
      return errorResponse(
        log,
        gatewayerror instanceof AbortError ? 504 : 502,
        `error fetching data from ${url}: ${gatewayerror}`,
      );
    }
  } catch (servererror) {
    if (servererror.statusCode) {
      return errorResponse(
        log,
        -servererror.statusCode,
        `Unable to fetch spreadsheet from onedrive (${servererror.statusCode}) - ${servererror.message}`,
        '',
        'max-age=60',
      );
    }

    return errorResponse(log, 500, servererror.toString(), '', 'max-age=60');
  }
}

module.exports = { handleJSON };
