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

function test(mp) {
  return !mp;
}

/**
 * Performs a lookup from the edit url to the source document.
 * @param {EditLookupOptions} opts options
 * @returns {Promise<string>} the resolved url
 */
async function getEditUrl(opts) {
  const {
    owner, repo, ref, resourcePath,
  } = opts;

  return `https://github.com/${owner}/${repo}/blob/${ref}${resourcePath}.md`;
}

module.exports = { name: 'github', getEditUrl, test };
