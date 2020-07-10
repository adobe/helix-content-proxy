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
const { utils } = require('@adobe/helix-shared');
const { AbortError } = require('@adobe/helix-fetch');
const { appendURLParams, fetch, getFetchOptions } = require('./utils');

async function handleJSON(opts, params) {
  const {
    mp, log, options,
  } = opts;

  const {
    AZURE_WORD2MD_CLIENT_ID: clientId,
    AZURE_WORD2MD_CLIENT_SECRET: clientSecret,
    AZURE_HELIX_USER: username,
    AZURE_HELIX_PASSWORD: password,
    namespace,
  } = options;

  try {
    const drive = new OneDrive({
      clientId,
      clientSecret,
      username,
      password,
      log,
    });

    log.debug(`resolving sharelink to ${mp.url}`);
    const rootItem = await drive.getDriveItemFromShareLink(mp.url);
    log.debug(`retrieving item-id for ${mp.relPath}.xlsx`);
    const item = await drive.getDriveItem(rootItem, encodeURI(`${mp.relPath}.xlsx`));
    const itemUri = OneDrive.driveItemToURL(item);
    const url = appendURLParams(`https://adobeioruntime.net/api/v1/web/${namespace}/helix-services/data-embed@v1`, {
      ...params,
      src: itemUri.toString(),
    });

    try {
      log.debug(`fetching data from ${url}`);
      const response = await fetch(url, getFetchOptions(options));
      const sourceLocation = response.headers.get('x-source-location') || itemUri.pathname;
      if (response.ok) {
        return {
          body: await response.json(),
          statusCode: 200,
          headers: {
            'content-type': 'application/json',
            // if the backend does not provide a source location, use the URL
            'x-source-location': sourceLocation,
            // enable fine-grained cache invalidation
            'surrogate-key': utils.computeSurrogateKey(sourceLocation),
            // cache for Runtime (non-flushable)
            'cache-control': response.headers.get('cache-control'),
            // cache for Fastly (flushable) – endless
            'surrogate-control': 'max-age=30758400, stale-while-revalidate=30758400, stale-if-error=30758400, immutable',
          },
        };
      }

      log[utils.logLevelForStatusCode(response.status)](`Unable to fetch ${url} (${response.status}) from data-embed`);
      return {
        statusCode: utils.propagateStatusCode(response.status),
        body: await response.text(),
        headers: {
          'cache-control': 'max-age=60',
        },
      };
    } catch (gatewayerror) {
      log.error(`error fetching data from ${url}: ${gatewayerror}`);
      return {
        body: gatewayerror.toString(),
        statusCode: gatewayerror instanceof AbortError ? 504 : 502, // no JSON = bad gateway
        headers: {
          'content-type': 'text/plain',
          // if the backend does not provide a source location, use the URL
          'x-source-location': url,
          // cache for Runtime (non-flushable)
          'cache-control': 'max-age=60',
        },
      };
    }
  } catch (servererror) {
    if (servererror.statusCode) {
      log[utils.logLevelForStatusCode(servererror.statusCode)](`Unable to fetch spreadsheet from onedrive (${servererror.statusCode}) - ${servererror.message}`);
      return {
        statusCode: utils.propagateStatusCode(servererror.statusCode),
        body: servererror.message,
        headers: {
          'cache-control': 'max-age=60',
        },
      };
    }

    log.error(servererror);
    return {
      body: servererror.toString(),
      statusCode: 500, // no config = servererror
      headers: {
        'content-type': 'text/plain',
        // cache for Runtime (non-flushable)
        'cache-control': 'max-age=60',
      },
    };
  }
}

module.exports = { handleJSON };
