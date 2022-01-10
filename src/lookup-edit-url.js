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
const { Response } = require('@adobe/helix-fetch');
const google = require('./google-edit-link.js');
const onedrive = require('./onedrive-edit-link.js');
const github = require('./github-edit-link.js');
const { getCredentials } = require('./credentials.js');
const { errorResponse } = require('./utils.js');

const HANDLERS = [
  google,
  onedrive,
  github,
];

/**
 * Performs a lookup from the edit url to the source document.
 * @param {EditLookupOptions} opts options
 * @returns {Promise<Response>} a http response
 */
async function lookupEditUrl(opts) {
  const {
    mount,
    uri,
    log,
    path,
    options,
    report,
  } = opts;

  // extract resource path w/o extension.
  // eg: /foo.bar/welcome.gift.md -> /foo.bar/welcome.gift
  const idxLastSlash = path.lastIndexOf('/');
  const idx = path.indexOf('.', idxLastSlash + 1);
  let resourcePath = idx < 0 ? path : path.substring(0, idx);
  let ext = idx < 0 ? '' : path.substring(idx + 1);
  if (idxLastSlash === path.length - 1) {
    resourcePath += 'index';
    ext = 'html';
  }

  // mountpoint
  const mp = mount.match(resourcePath);
  const handler = HANDLERS.find(({ test }) => test && test(mp));
  if (!handler) {
    return errorResponse(log, 404, `No handler found for document ${uri}.`, 'Not Found');
  }

  // extract credentials
  if (options.gitHubToken) {
    options.credentials = getCredentials(log, mp, options.gitHubToken);
  }

  let location;
  try {
    location = await handler.getEditUrl({
      mp,
      resourcePath,
      ext,
      ...opts,
    });
  } catch (e) {
    log.warn(`Handler ${handler.name} threw an error:`, e);
  }

  if (!location) {
    return errorResponse(log, 404, `Handler ${handler.name} could not lookup ${uri}.`, 'Not Found');
  }

  if (report) {
    const body = JSON.stringify({
      sourcePath: path,
      editUrl: location,
    });
    return new Response(body, {
      status: 200,
      headers: {
        'cache-control': 'no-store, private, must-revalidate',
        'content-type': 'application/json',
      },
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

module.exports = lookupEditUrl;
