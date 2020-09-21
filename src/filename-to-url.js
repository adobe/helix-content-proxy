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

/**
 * Sanitizes the filename by:
 * - convert to lower case
 * - normalize all unicode characters
 * - replace all non-alphanumeric characters with a dash
 * - remove all consecutive dashes
 * - remove all leading and trailing dashes
 *
 * Note that only the basename of the file path is sanitized. i.e. The ancestor path and the
 * extension is not affected.
 *
 * @param {string} filepath the file path
 * @param {object} opts Options
 * @param {boolean} [opts.ignoreExtension] if {@code true} ignores the extension
 * @returns {string} sanitized file path
 */
function filename2url(filepath, opts = {}) {
  const idx = filepath.lastIndexOf('/') + 1;
  const extIdx = opts.ignoreExtension ? -1 : filepath.lastIndexOf('.');
  const pfx = filepath.substring(0, idx);
  const basename = extIdx < idx ? filepath.substring(idx) : filepath.substring(idx, extIdx);
  const ext = extIdx < idx ? '' : filepath.substring(extIdx);
  const name = basename
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${pfx}${name}${ext}`;
}

module.exports = {
  filename2url,
};
