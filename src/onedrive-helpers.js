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

/**
 * Returns a onedrive client for the given _external_ options.
 * @param {ExternalOptions} opts the _external_ options.
 * @returns {OneDrive} the OneDrive client
 */
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

  if (!clientOpts.username && !clientOpts.refreshToken) {
    clientOpts.username = options.AZURE_HELIX_USER;
    clientOpts.password = options.AZURE_HELIX_PASSWORD;
  }

  return new OneDrive(clientOpts);
}

/**
 * Returns the access token to authenticate again onedrive / sharepoint.
 * @param {ExternalOptions|OneDrive} opts the _external_ options or an onedrive client.
 * @returns {string} the access token or empty string if it could not be retrieved.
 */
async function getAccessToken(opts) {
  try {
    let drive;
    if ('getAccessToken' in opts) {
      drive = opts;
    } else if (opts.options && opts.options.AZURE_WORD2MD_CLIENT_ID) {
      drive = await getOneDriveClient(opts);
    } else {
      opts.log.info('unable to get access token. no onedrive client.');
      return '';
    }
    const { accessToken } = await drive.getAccessToken();
    return accessToken;
  } catch (e) {
    opts.log.warn(`error while retrieving access token: ${e.message}`);
    return '';
  }
}

module.exports = {
  getOneDriveClient,
  getAccessToken,
};
