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
/* eslint-disable no-param-reassign */
const { URL } = require('url');
const fetchAPI = require('@adobe/helix-fetch');

function createFetchContext() {
  /* istanbul ignore next */
  if (process.env.HELIX_FETCH_FORCE_HTTP1) {
    return fetchAPI.context({ httpProtocol: 'http1', httpsProtocols: ['http1'] });
  }
  /* istanbul ignore next */
  return fetchAPI.context({});
}
const fetchContext = createFetchContext();
const { fetch } = fetchContext;

function appendURLParams(url, params) {
  const u = new URL(url);
  u.searchParams = Object.entries(params).reduce((p, [key, value]) => {
    if (value) {
      p.append(key, value);
    }
    return p;
  }, u.searchParams);

  return u.href;
}

/**
 * Returns fetch compatible options for the given handler options.
 * @param {object} options Handler options
 * @return {object} fetch options.
 */
function getFetchOptions(options) {
  const fetchopts = {
    headers: {},
    ...options,
  };
  if (options.requestId) {
    fetchopts.headers['x-request-id'] = options.requestId;
  }
  delete fetchopts.requestId;
  // delete all secrets
  Object.keys(fetchopts)
    .forEach((key) => {
      if (key.match(/^[A-Z0-9_]+$/)) {
        delete fetchopts[key];
      }
    });
  return fetchopts;
}

module.exports = {
  appendURLParams,
  fetch,
  fetchContext,
  getFetchOptions,
};
