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
const { Response } = require('@adobe/helix-fetch');
const { utils } = require('@adobe/helix-shared');
const { getFile, getIdFromPath } = require('./google-helpers.js');

async function handleSitemapXML(opts) {
  const { mp, log, options } = opts;

  const path = `${mp.relPath.substring(1)}.xml`;
  try {
    log.info(`fetch sitemap from gdrive: ${path}`);
    const fileId = await getIdFromPath(path, mp.id, log, options);
    if (!fileId) {
      return new Response('sitemap not found', {
        status: 404,
        headers: {
          'cache-control': 'no-store, private, must-revalidate',
        },
      });
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
    log.error(`error fetching data: ${e.message} (${e.code})`);
    return new Response('', {
      status: 502,
      headers: {
        'cache-control': 'no-store, private',
      },
    });
  }
}

module.exports = { handleSitemapXML };
