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
const LRU = require('lru-cache');

class PenaltyBox {
  /**
   * Creates a new penalty box with a given timeout
   * @param {Number} timeout timeout in seconds
   */
  constructor(timeout = 30) {
    this.box = new LRU({ max: 1000, maxAge: timeout * 1000 });
  }

  foul(owner, repo) {
    this.box.set(`${owner}/${repo}`, new Date());
  }

  ready(owner, repo) {
    return !this.box.peek(`${owner}/${repo}`);
  }
}

module.exports = PenaltyBox;
