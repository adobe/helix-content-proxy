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

const google = require('./google-reverse.js');
const onedrive = require('./onedrive-reverse.js');
// const github = require('./github-reverse.js');

const HANDLERS = [
  google,
  onedrive,
  // github,
];

async function reverseLookup(opts) {
  const {
    uri,
    log,
    ref,
    repo,
    owner,
  } = opts;
  const handler = HANDLERS.find(({ test }) => test(uri));
  if (!handler) {
    log.error(`No handler found document ${uri}.`);
    return {
      'cache-control': 'no-store, private, must-revalidate',
      body: 'not found',
      statusCode: 404,
    };
  }

  const documentPath = await handler.lookup(opts);

  if (!documentPath) {
    log.error(`Handler ${handler.name} could not lookup ${uri}.`);
    return {
      'cache-control': 'no-store, private, must-revalidate',
      body: 'not found',
      statusCode: 404,
    };
  }

  let { prefix } = opts;
  if (!prefix) {
    prefix = `${repo}--${owner}.hlx.page`;
    if (ref && ref !== 'master' && ref !== 'main') {
      prefix = `https://${ref}--${prefix}`;
    } else {
      prefix = `https://${prefix}`;
    }
  }

  const location = `${prefix}${documentPath}`;
  return {
    'cache-control': 'no-store, private, must-revalidate',
    statusCode: 302,
    body: location,
    headers: {
      location,
    },
  };
}

module.exports = reverseLookup;
