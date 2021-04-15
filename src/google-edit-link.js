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
const { getIdFromPath } = require('./google-helpers.js');

function test(mp) {
  return mp && mp.type === 'google';
}

/**
 * Performs a lookup from the edit url to the source document.
 * @param {EditLookupOptions} opts options
 * @returns {Promise<string>} the resolved url
 */
async function getEditUrl(opts) {
  const {
    mp, log, ext, options,
  } = opts;

  // if (options.credentials) {
  // todo: respect credentials
  // }

  const docId = await getIdFromPath(mp.relPath.substring(1), mp.id, log, options);
  if (!docId) {
    return '';
  }
  const type = ext === 'json' ? 'spreadsheets' : 'document';
  return `https://docs.google.com/${type}/d/${docId}/edit`;
}

module.exports = { name: 'google', getEditUrl, test };
