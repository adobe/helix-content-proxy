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

const { OneDrive } = require('@adobe/helix-onedrive-support');

async function getOneDriveClient(opts) {
  const {
    log, options,
  } = opts;

  const clientOpts = {
    log,
    clientId: options.AZURE_WORD2MD_CLIENT_ID,
    clientSecret: options.AZURE_WORD2MD_CLIENT_SECRET,
  };

  if (options.credentials) {
    if (options.credentials.r) {
      log.info('using mountpoint specific refresh token');
      clientOpts.refreshToken = options.credentials.r;
    } else if (options.credentials.u && options.credentials.p) {
      log.info('using mountpoint specific username / password');
      clientOpts.username = options.credentials.u;
      clientOpts.password = options.credentials.p;
    } else {
      log.info('unknown credentials specified for mountpoint');
    }
  }

  if (!clientOpts.username || !clientOpts.refreshToken) {
    clientOpts.username = options.AZURE_HELIX_USER;
    clientOpts.password = options.AZURE_HELIX_PASSWORD;
  }

  return new OneDrive(clientOpts);
}

async function getAccessToken(opts) {
  const drive = await getOneDriveClient(opts);
  return drive.getAccessToken();
}

module.exports = {
  getOneDriveClient,
  getAccessToken,
};
