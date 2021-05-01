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
const { filename2url } = require('./filename-to-url.js');
const google = require('./google-reverse.js');
const onedrive = require('./onedrive-reverse.js');
const { errorResponse } = require('./utils');

const HANDLERS = [
  google,
  onedrive,
  // github,
];

/**
 * Performs a reverse lookup from an edit url to a website url.
 * @param {ReverseLookupOptions} opts the options.
 * @returns {Promise<Response>} a http response
 */
async function reverseLookup(opts) {
  const {
    uri,
    log,
    ref,
    repo,
    owner,
    report,
    origin,
  } = opts;
  const handler = HANDLERS.find(({ test }) => test(uri));
  if (!handler) {
    return errorResponse(log, 404, `No handler found document ${uri}.`, 'Not Found');
  }

  const documentPath = await handler.lookup(opts);

  if (!documentPath) {
    return errorResponse(log, 404, `Handler ${handler.name} could not lookup ${uri}.`, 'Not Found');
  }

  let { prefix } = opts;
  if (!prefix) {
    prefix = `https://${ref}--${repo}--${owner}.hlx.page`;
  }

  // make author friendly
  const friendlyPath = encodeURI(filename2url(decodeURI(documentPath), {
    ignoreExtension: !documentPath.endsWith('.json'),
  }));
  const location = `${prefix}${friendlyPath}`;

  if (report) {
    const body = JSON.stringify({
      sourceUrl: uri.toString(),
      webUrl: location,
      unfriendlyWebUrl: `${prefix}${documentPath}`,
    });

    // set cors headers if needed
    const ALLOWED_ORIGINS = [
      /^https:\/\/.*\.sharepoint.com$/,
      /^https:\/\/drive\.google\.com$/,
      /^https:\/\/github\.com$/,
    ];

    const headers = {
      'cache-control': 'no-store, private, must-revalidate',
      'content-type': 'application/json',
    };

    if (ALLOWED_ORIGINS.find((pat) => pat.exec(origin))) {
      log.info(`setting cors headers for origin: ${origin}`);
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS';
    } else {
      log.info(`no cors headers for origin: ${origin}`);
    }

    return new Response(body, {
      status: 200,
      headers,
    });
  }

  return new Response(location, {
    status: 302,
    headers: {
      'cache-control': 'no-store, private, must-revalidate',
      location,
    },
  });
}

module.exports = reverseLookup;
