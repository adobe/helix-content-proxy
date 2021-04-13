/*
 * Copyright 2021 Adobe. All rights reserved.
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
const { Response } = require('@adobe/helix-universal');
const { errorResponse } = require('./utils');

async function handleSitemapXML(opts) {
  const {
    mp, log, options,
  } = opts;

  const {
    AZURE_WORD2MD_CLIENT_ID: clientId,
    AZURE_WORD2MD_CLIENT_SECRET: clientSecret,
    AZURE_HELIX_USER: username,
    AZURE_HELIX_PASSWORD: password,
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
    log.debug(`retrieving item-id for ${mp.relPath}.xml`);
    const [item] = await drive.fuzzyGetDriveItem(rootItem, encodeURI(`${mp.relPath}.xml`));
    if (!item) {
      const error = new Error('Not found');
      error.statusCode = 404;
      throw error;
    }
    const body = await drive.downloadDriveItem(item);
    const sourceLocation = OneDrive.driveItemToURL(item).pathname;
    return new Response(body, {
      status: 200,
      headers: {
        'content-type': 'application/xml',
        // if the backend does not provide a source location, use the URL
        'x-source-location': sourceLocation,
        // enable fine-grained cache invalidation
        'surrogate-key': utils.computeSurrogateKey(sourceLocation),
        // cache for Runtime (non-flushable)
        'cache-control': 'no-store, private',
        // cache for Fastly (flushable) – endless
        'surrogate-control': 'max-age=30758400, stale-while-revalidate=30758400, stale-if-error=30758400, immutable',
      },
    });
  } catch (servererror) {
    if (servererror.statusCode) {
      return errorResponse(log, -servererror.statusCode,
        `Unable to fetch file from onedrive (${servererror.statusCode}) - ${servererror.message}`);
    }
    return errorResponse(log, 500, servererror.toString());
  }
}

module.exports = { handleSitemapXML };
