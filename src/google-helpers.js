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
const { google } = require('googleapis');
const cache = require('./cache');

/**
 * Remember the access token for future action invocations.
 */
let tokenCache = {};

function createOAuthClient(options, creds) {
  const oAuth2Client = new google.auth.OAuth2(options);
  oAuth2Client.setCredentials({
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    ...tokenCache,
    ...creds,
  });
  oAuth2Client.on('tokens', (tokens) => {
    tokenCache = tokens;
  });

  return oAuth2Client;
}

const createCachedOAuthClient = cache(createOAuthClient);

async function getUncachedIdFromPath(path, parentId, log, options) {
  const {
    GOOGLE_DOCS2MD_CLIENT_ID: clientId,
    GOOGLE_DOCS2MD_CLIENT_SECRET: clientSecret,
    // eslint-disable-next-line camelcase
    GOOGLE_DOCS2MD_REFRESH_TOKEN: refresh_token,
  } = options;

  const auth = await createCachedOAuthClient({ clientId, clientSecret }, { refresh_token });

  const drive = google.drive({
    version: 'v3',
    auth,
  });

  const [name, ...rest] = path.split('/');

  const query = [
    `'${parentId}' in parents`,
    `and name = ${JSON.stringify(name)}`,
    'and trashed=false',
    // folder if path continues, sheet otherwise
    `and mimeType ${rest.length ? '=' : '!='} 'application/vnd.google-apps.folder'`].join(' ');
  log.debug(query);

  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });

  const [item] = res && res.data && res.data.files && res.data.files.length
    ? res.data.files : [];

  if (item && rest.length) {
    // eslint-disable-next-line no-use-before-define
    return getIdFromPath(rest.join('/'), item.id, log, options);
  } else if (item) {
    return item.id;
  }
  return null;
}

const getIdFromPath = cache(getUncachedIdFromPath);

async function getFilePath(log, drive, fileId, roots) {
  log.debug(`getFilePath(${fileId})`);
  const { data } = (await drive.files.get({
    fileId,
    fields: [
      'name',
      'parents',
    ].join(','),
  }));
  const parentId = data.parents ? data.parents[0] : '';
  if (parentId) {
    const root = roots[parentId];
    if (root) {
      // stop at mount root
      return `${root}${data.name}`;
    }
    const parentPath = await getFilePath(log, drive, data.parents[0], roots);
    return `${parentPath}/${data.name}`;
  } else {
    return `/root:/${data.name}`;
  }
}

async function getPathFromId(fileId, roots, options) {
  const {
    GOOGLE_DOCS2MD_CLIENT_ID: clientId,
    GOOGLE_DOCS2MD_CLIENT_SECRET: clientSecret,
    // eslint-disable-next-line camelcase
    GOOGLE_DOCS2MD_REFRESH_TOKEN: refresh_token,
    log,
  } = options;

  const auth = await createCachedOAuthClient({ clientId, clientSecret }, { refresh_token });

  const drive = google.drive({
    version: 'v3',
    auth,
  });
  return getFilePath(log, drive, fileId, roots);
}

module.exports = {
  createOAuthClient,
  createCachedOAuthClient,
  getUncachedIdFromPath,
  getIdFromPath,
  getPathFromId,
};
