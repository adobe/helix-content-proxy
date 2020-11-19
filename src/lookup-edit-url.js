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
const google = require('./google-edit-link.js');
const onedrive = require('./onedrive-edit-link.js');
const github = require('./github-edit-link.js');

const HANDLERS = [
  google,
  onedrive,
  github,
];

async function lookupEditUrl(opts) {
  const {
    mount,
    uri,
    log,
  } = opts;

  // extract resource path w/o extension.
  // eg: /foo.bar/welcome.gift.md -> /foo.bar/welcome.gift
  const { pathname } = uri;
  const idxLastSlash = pathname.lastIndexOf('/');
  const idx = pathname.indexOf('.', idxLastSlash + 1);
  let resourcePath = idx < 0 ? pathname : pathname.substring(0, idx);
  let ext = idx < 0 ? '' : pathname.substring(idx + 1);
  if (idxLastSlash === pathname.length - 1) {
    resourcePath += 'index';
    ext = 'html';
  }

  // mountpoint
  const mp = mount.match(resourcePath);
  const handler = HANDLERS.find(({ test }) => test && test(mp));
  if (!handler) {
    log.error(`No handler found for document ${uri}.`);
    return {
      'cache-control': 'no-store, private, must-revalidate',
      body: 'not found',
      statusCode: 404,
    };
  }

  const location = await handler.getEditUrl({
    mp,
    resourcePath,
    ext,
    ...opts,
  });

  if (!location) {
    log.error(`Handler ${handler.name} could not lookup ${uri}.`);
    return {
      'cache-control': 'no-store, private, must-revalidate',
      body: 'not found',
      statusCode: 404,
    };
  }

  return {
    'cache-control': 'no-store, private, must-revalidate',
    statusCode: 302,
    body: location,
    headers: {
      location,
    },
  };
}

module.exports = lookupEditUrl;
