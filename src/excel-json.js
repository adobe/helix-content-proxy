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

const { fetch } = require('@adobe/helix-fetch').context({
  httpsProtocols:
  /* istanbul ignore next */
  process.env.HELIX_FETCH_FORCE_HTTP1 ? ['http1'] : ['http2', 'http1'],
});
const { OneDrive } = require('@adobe/helix-onedrive-support');

async function handleJSON(opts) {
  const {
    mp, log, options,
  } = opts;

  const {
    AZURE_WORD2MD_CLIENT_ID: clientId,
    AZURE_WORD2MD_CLIENT_SECRET: clientSecret,
//    AZURE_WORD2MD_REFRESH_TOKEN: refreshToken,
    AZURE_HELIX_USER: username,
    AZURE_HELIX_PASSWORD: password,
  } = options;

  const drive = new OneDrive({
    clientId,
    clientSecret,
//    refreshToken,
    username,
    password,
    log,
  });

  console.log(await drive.me());

  const rootItem = await drive.getDriveItemFromShareLink(mp.url);
  const item = await drive.getDriveItem(rootItem, encodeURI(mp.relPath + '.xlsx'));

  console.log(item);
}


module.exports = { handleJSON };
