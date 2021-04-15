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
const { Response } = require('@adobe/helix-universal');
const { utils } = require('@adobe/helix-shared');
const { getFile, getIdFromPath } = require('./google-helpers.js');
const { errorResponse } = require('./utils.js');

/**
 * Fetches an google sheet with sitemap data from the external source.
 * @param {ExternalHandlerOptions} opts the options.
 * @returns {Promise<Response>} a http response
 */
async function handleSitemapXML(opts) {
  const { mp, log, options } = opts;

  // if (options.credentials) {
  //   // todo: respect credentials
  // }

  const path = `${mp.relPath.substring(1)}.xml`;
  try {
    log.info(`fetch sitemap from gdrive: ${path}`);
    const fileId = await getIdFromPath(path, mp.id, log, options);
    if (!fileId) {
      return errorResponse(log, 404, 'sitemap not found');
    }
    const file = await getFile(fileId, log, options);
    return new Response(file, {
      status: 200,
      headers: {
        'content-type': 'application/xml',
        'x-source-location': fileId,
        'surrogate-key': utils.computeSurrogateKey(fileId),
        // cache for Runtime (non-flushable)
        'cache-control': 'no-store, private',
        // cache for Fastly (flushable) – endless
        'surrogate-control': 'max-age=30758400, stale-while-revalidate=30758400, stale-if-error=30758400, immutable',
      },
    });
  } catch (e) {
    return errorResponse(log, 502, `error fetching data: ${e.message} (${e.code})`);
  }
}

module.exports = { handleSitemapXML };
