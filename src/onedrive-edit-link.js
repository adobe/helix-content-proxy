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

const { getOneDriveClient } = require('./onedrive-helpers.js');

function test(mp) {
  return mp && mp.type === 'onedrive';
}

/**
 * Performs a lookup from the edit url to the source document.
 * @param {EditLookupOptions} opts options
 * @returns {Promise<string>} the resolved url
 */
async function getEditUrl(opts) {
  const { mp, log } = opts;
  const drive = await getOneDriveClient(opts);
  log.debug(`resolving sharelink to ${mp.url}`);
  const rootItem = await drive.getDriveItemFromShareLink(mp.url);
  log.debug(`retrieving item for ${mp.relPath}`);
  const [item] = await drive.fuzzyGetDriveItem(rootItem, mp.relPath);
  if (!item) {
    return '';
  }
  if (item.webUrl.endsWith('.md')) {
    // the sharepoint url looks like: /sites/<site>/<list><filePath>
    const url = new URL(decodeURIComponent(item.webUrl));
    const segs = decodeURI(url.pathname).split(/\/+/);
    const prefix = segs.slice(0, 4).join('/');
    const parentPath = segs.slice(0, segs.length - 1).join('/');

    const newUrl = new URL(`${prefix}/Forms/AllItems.aspx`, url);
    newUrl.searchParams.append('id', decodeURI(url.pathname));
    newUrl.searchParams.append('parent', parentPath);
    newUrl.searchParams.append('p', 5);
    return newUrl.href;
  }
  return item.webUrl;
}

module.exports = { name: 'onedrive', getEditUrl, test };
