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

const { OneDrive } = require('@adobe/helix-onedrive-support');

function test(mp) {
  return mp && mp.type === 'onedrive';
}

async function getEditUrl(opts) {
  const {
    mp, log, options,
  } = opts;

  const {
    AZURE_WORD2MD_CLIENT_ID: clientId,
    AZURE_WORD2MD_CLIENT_SECRET: clientSecret,
    AZURE_HELIX_USER: username,
    AZURE_HELIX_PASSWORD: password,
  } = options;

  const drive = new OneDrive({
    clientId,
    clientSecret,
    username,
    password,
    log,
  });

  log.debug(`resolving sharelink to ${mp.url}`);
  const rootItem = await drive.getDriveItemFromShareLink(mp.url);
  log.debug(`retrieving item for ${mp.relPath}`);
  let [item] = await drive.fuzzyGetDriveItem(rootItem, mp.relPath);
  if (!item) {
    return '';
  }
  if (!item.webUrl) {
    // temporary workaround until fuzzyGetDriveItem returns webUrl
    item = await drive.getDriveItem(item);
  }
  return item.webUrl;
}

module.exports = { getEditUrl, test };
