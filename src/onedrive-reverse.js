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

function test(uri) {
  return /^.+\.sharepoint.com$/.test(uri.hostname);
}

/**
 * Does a reverse lookup for a onedrive/sharepoint document.
 *
 * Possible document urls format (as seen in the browser):
 *
 * Documents:
 * - https://{tenant}/:w:/r/{site}/{subsite}/_layouts/15/Doc.aspx?sourcedoc=%7B{listItemId}%7D&file={filename.docx}&action=default&mobileredirect=true
 *
 * Spreadsheets:
 * - https://{tenant}/:x:/r/{site}/{subsite}/_layouts/15/Doc.aspx?sourcedoc=%7B{listItemId}%7D&file={filename.xlsx}&action=default&mobileredirect=true
 *
 * Markdown files:
 * - https://{tenant}/{site}/{subsite}/{drive}/Forms/AllItems.aspx?id={filePath}&parent={parentPath}
 *
 * Markdown files (on different tenants):
 * - https://{tenant}/{site}/{subsite}/{drive}/Forms/AllItems.aspx?listurl={listurl}&id={filePath}&parent={parentPath}
 *
 * @param opts
 * @returns {Promise<string>}
 */
async function reverseLookup(opts) {
  const {
    mount,
    uri,
    options,
    log,
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

  const segs = uri.pathname.substring(1)
    .split('/')
    .filter((s) => s !== 'r' && s !== ':w:' && s !== ':x:');
  const sourceDoc = uri.searchParams.get('sourcedoc');
  const id = uri.searchParams.get('id');

  let docPath;
  let docHost = uri.hostname;
  if (sourceDoc) {
    // for documents and sheets, the uri only contains a sharepoint id. so we need to get the
    // path via the webUrl of the list item.
    const idx = Math.max(segs.indexOf('_layouts'), 2);
    const site = segs[idx - 2];
    const subSite = segs[idx - 1];
    const list = uri.searchParams.get('ListId') || 'documents';
    const itemId = sourceDoc.replace(/[{}]/g, '');
    const listUri = `/sites/${uri.hostname}:/${site}/${subSite}:/lists/${list}/items/${itemId}`;
    log.info(`retrieving sharepoint item with ${listUri}`);
    try {
      // eslint-disable-next-line no-await-in-loop
      const client = await drive.getClient();
      const { webUrl } = await client.get(listUri);
      const docUrl = new URL(webUrl);
      docPath = docUrl.pathname;
      docHost = docUrl.hostname;
      log.info('path/host from weburl', docPath, docHost);
    } catch (e) {
      log.error('error while lookup sharepoint item: ', e.message);
      return '';
    }
  } else {
    docPath = encodeURI(id);
    const listUrl = uri.searchParams.get('listurl');
    if (listUrl) {
      docHost = new URL(listUrl).hostname;
    }
    log.info('path/host from id:', docPath, docHost);
  }

  // find mountpoint that matches the document path and root
  return mount.mountpoints.reduce((path, mp) => {
    if (path || mp.type !== 'onedrive') {
      return path;
    }
    const rootUrl = new URL(mp.url);
    if (rootUrl.hostname !== docHost) {
      return '';
    }
    const rootDir = `${rootUrl.pathname}/`;
    log.info(`testing ${rootDir}`);
    if (!docPath.startsWith(rootDir)) {
      return '';
    }
    let relPath = docPath.substring(rootDir.length);
    // replace extension
    let ext = '';
    const idx = relPath.lastIndexOf('.');
    if (idx > 0) {
      ext = relPath.substring(idx);
      relPath = relPath.substring(0, idx);
    }
    ext = ext === '.xlsx' ? '.json' : '.html';
    return `${mp.path}${relPath}${ext}`;
  }, '');
}

module.exports = {
  name: 'onedrive',
  test,
  lookup: reverseLookup,
};
