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

/* eslint-env mocha */

const assert = require('assert');
const { MountConfig } = require('@adobe/helix-shared');
const { getCredentials, encrypt } = require('../src/credentials.js');

const TEST_KEY = 'hello-key';

describe('Credentials Tests', () => {
  it('returns null for mountpoint w/o credentials', async () => {
    const fstab = await new MountConfig()
      .withSource(`
      mountpoints:
        /: https://my.sharepoint.com/foo
      `).init();
    const mp = fstab.match('/foo');
    assert.deepEqual(getCredentials(console, mp, TEST_KEY), null);
  });

  it('returns null for mountpoint with invalid credentials', async () => {
    const fstab = await new MountConfig()
      .withSource(`
      mountpoints:
        /: 
          url: https://my.sharepoint.com/foo
          credentials: 
            - foobar
            -
            - asbar
      `).init();
    const mp = fstab.match('/foo');
    assert.deepEqual(getCredentials(console, mp, TEST_KEY), null);
  });

  it('returns correct credentials', async () => {
    const creds = encrypt(TEST_KEY, JSON.stringify({ user: 'foo', pass: 'bar' }));
    const fstab = await new MountConfig()
      .withSource(`
      mountpoints:
        /: 
          url: https://my.sharepoint.com/foo
          credentials: ${creds}
      `).init();
    const mp = fstab.match('/foo');
    assert.deepEqual(getCredentials(console, mp, TEST_KEY), {
      user: 'foo',
      pass: 'bar',
    });
  });

  it('ignores outdated credentials', async () => {
    const creds1 = encrypt('old-key', JSON.stringify({ user: 'zoo', pass: 'panda' }));
    const creds2 = encrypt(TEST_KEY, JSON.stringify({ user: 'foo', pass: 'bar' }));
    const fstab = await new MountConfig()
      .withSource(`
      mountpoints:
        /: 
          url: https://my.sharepoint.com/foo
          credentials: 
            - ${creds1}
            - ${creds2}
      `).init();
    const mp = fstab.match('/foo');
    assert.deepEqual(getCredentials(console, mp, TEST_KEY), {
      user: 'foo',
      pass: 'bar',
    });
  });

  it('returns null for non json string credentials', async () => {
    const creds = encrypt(TEST_KEY, 'this is not json!');
    const fstab = await new MountConfig()
      .withSource(`
      mountpoints:
        /: 
          url: https://my.sharepoint.com/foo
          credentials: ${creds}
      `).init();
    const mp = fstab.match('/foo');
    assert.deepEqual(getCredentials(console, mp, TEST_KEY), null);
  });
});
