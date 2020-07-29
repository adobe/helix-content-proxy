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
const { getPathFromId } = require('./google-helpers.js');

function test(uri) {
  return uri.hostname === 'drive.google.com'
    || uri.hostname === 'docs.google.com'
    || uri.protocol === 'gdrive:';
}

async function reverseLookup(opts) {
  const {
    mount,
    uri,
    options,
    log,
  } = opts;

  let type;
  let id;
  if (uri.protocol === 'gdrive:') {
    id = uri.pathname;
  } else {
    // https://docs.google.com/spreadsheets/d/1IDFZH5HVoYIg9siz1rK7d3hqAOeUpVc4WsgCdf2IMyA/edit
    // https://docs.google.com/document/d/1nbKakMrvDhf032da2hEYuxU30cdUmyZPv1kuRCKXiho/edit
    [, type, , id] = uri.pathname.split('/');
    log.debug(`id: ${id} segs: ${uri.pathname.split('/')}`);
  }

  // get all the google mountpoints and their root ids
  const roots = {};
  mount.mountpoints.forEach((mp) => {
    if (mp.type === 'google') {
      roots[mp.id] = mp.path;
    }
  });
  log.debug('mount roots', roots);

  const path = await getPathFromId(id, roots, {
    log,
    ...options,
  });
  // ignore documents outside a mountpoint
  if (path.startsWith('/root:/')) {
    return '';
  }
  const ext = type === 'spreadsheets' ? '.json' : '.html';
  return `${path}${ext}`;
}

module.exports = {
  name: 'google',
  test,
  lookup: reverseLookup,
};
