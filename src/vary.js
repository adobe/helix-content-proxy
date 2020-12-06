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
const VARY_HDR_VERSION_LOCK = 'x-ow-version-lock';

function vary(func) {
  return async (params) => {
    const ret = await func(params);
    if (!ret.headers) {
      ret.headers = {};
    }
    if (!ret.headers.vary) {
      ret.headers.vary = VARY_HDR_VERSION_LOCK;
    } else if (ret.headers.vary.toLowerCase().indexOf(VARY_HDR_VERSION_LOCK) < 0) {
      ret.headers.vary = `${ret.headers.vary},${VARY_HDR_VERSION_LOCK}`;
    }
    return ret;
  };
}

module.exports = vary;
