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

/* eslint-env mocha */

process.env.HELIX_FETCH_FORCE_HTTP1 = 'true';

const assert = require('assert');
const { main } = require('../src/index.js');
const { setupPolly } = require('./utils.js');

describe('GitHub Integration Tests', () => {
  setupPolly({
    recordIfMissing: false,
  });

  it('Retrieves Markdown from GitHub', async () => {
    const result = await main({
      owner: 'adobe',
      repo: 'helix-pipeline',
      ref: '9526b3b315a8b8a5e48c8e70fff362bf43426020',
      path: 'docs/markdown.md',
      __ow_headers: {
        'x-request-id': 'fake',
      },
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.indexOf('# Markdown Features in Project Helix'), 0);
  });

  it('Retrieves Markdown from GitHub with Token from Headers', async function staticToken() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/project-helix/master/fstab.yaml')
      .intercept((_, res) => res.sendStatus(404));

    let foundtoken;
    let foundid;
    server
      .get('https://raw.githubusercontent.com/adobe/project-helix/master/README.md')
      .intercept((req, res) => {
        foundtoken = req.headers.authorization;
        foundid = req.headers['x-request-id'];
        res.status(200).send('# Read me');
      });

    const result = await main({
      owner: 'adobe',
      repo: 'project-helix',
      ref: 'master',
      path: 'README.md',
      __ow_headers: {
        'x-request-id': 'fake',
        'x-github-token': 'undisclosed-token',
      },
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.indexOf('# Read me'), 0);
    assert.equal(foundtoken, 'token undisclosed-token');
    assert.equal(foundid, 'fake');
  });

  it('Retrieves Markdown from GitHub with Token from Config', async function staticToken() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/project-helix/master/fstab.yaml')
      .intercept((_, res) => res.sendStatus(404));

    let foundtoken;
    let foundid;
    server
      .get('https://raw.githubusercontent.com/adobe/project-helix/master/README.md')
      .intercept((req, res) => {
        foundtoken = req.headers.authorization;
        foundid = req.headers['x-request-id'];
        res.status(200).send('# Read me');
      });

    const result = await main({
      owner: 'adobe',
      repo: 'project-helix',
      ref: 'master',
      path: 'README.md',
      __ow_headers: {
        'x-request-id': 'fake',
      },
      GITHUB_TOKEN: 'fake-token',
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.indexOf('# Read me'), 0);
    assert.equal(foundtoken, 'token fake-token');
    assert.equal(foundid, 'fake');
  });

  it('Retrieves Markdown from GitHub with low cache', async () => {
    const result = await main({
      owner: 'adobe',
      repo: 'helix-pipeline',
      ref: 'master',
      path: 'docs/markdown.md',
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.indexOf('# Markdown Features in Project Helix'), 0);
    assert.equal(result.headers['cache-control'], 'max-age=60');
    assert.equal(result.headers['surrogate-control'], 'max-age=60');
  });

  it('Retrieves Markdown from GitHub when FSTab.yaml is present', async () => {
    const result = await main({
      owner: 'adobe',
      repo: 'theblog',
      ref: '04f19cd404780382c5a53d0cf64fbe4b0b827eff',
      path: '/index.md',
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.indexOf('---'), 0);
    assert.equal(result.headers['x-source-location'], 'https://raw.githubusercontent.com/adobe/theblog/04f19cd404780382c5a53d0cf64fbe4b0b827eff/index.md');
    assert.equal(result.headers['cache-control'], 'max-age=30758400');
    assert.equal(result.headers['surrogate-control'], 'max-age=30758400, stale-while-revalidate=30758400, stale-if-error=30758400, immutable');
  });

  it('Fails to retrieve Markdown from GitHub is malfunctioning', async function badGitHub() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a2/fstab.yaml')
      .intercept((_, res) => res.sendStatus(500));

    const result = await main({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'cb8a0dc5d9d89b800835166783e4130451d3c6a2',
      path: '/index.md',
    });

    assert.equal(result.statusCode, 502);
  });

  it('Fails to retrieve Markdown from GitHub is down', async function badGitHub() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a2/fstab.yaml')
      .intercept((_, res) => res.sendStatus(503));

    const result = await main({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'cb8a0dc5d9d89b800835166783e4130451d3c6a2',
      path: '/index.md',
    });

    assert.equal(result.statusCode, 503);
  });

  it('Fails to retrieve Markdown from GitHub is partially down', async function badGitHub() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a2/fstab.yaml')
      .intercept((_, res) => res.sendStatus(404));

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a2/index.md')
      .intercept((_, res) => res.sendStatus(503));

    const result = await main({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'cb8a0dc5d9d89b800835166783e4130451d3c6a2',
      path: '/index.md',
    });

    assert.equal(result.statusCode, 503);
  });

  const fstab = `
mountpoints:
  /ms: https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/theblog
  /g: https://drive.google.com/drive/u/0/folders/1bH7_28a1-Q3QEEvFhT9eTmR-D7_9F4xP
`;

  it('Does not fetch FSTab twice', async function doubleFetch() {
    const { server } = this.polly;
    let fstabfetches = 0;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a1/fstab.yaml')
      .intercept((_, res) => {
        fstabfetches += 1;
        return res.status(200).send(fstab);
      });

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a1/hello.md')
      .intercept((_, res) => res.status(200).send('Hello'));
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a1/world.md')
      .intercept((_, res) => res.status(200).send('World'));

    const result1 = await main({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'cb8a0dc5d9d89b800835166783e4130451d3c6a1',
      path: '/hello.md',
    });

    const result2 = await main({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'cb8a0dc5d9d89b800835166783e4130451d3c6a1',
      path: '/world.md',
    });

    assert.equal(result1.body, 'Hello');
    assert.equal(result2.body, 'World');
    assert.equal(fstabfetches, 1);
  });

  it('Fetches FSTab twice if the first fetch fails', async function doubleFetch() {
    const { server } = this.polly;
    let fstabfetches = 0;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a8/fstab.yaml')
      .intercept((_, res) => {
        fstabfetches += 1;
        if (fstabfetches < 2) {
          // fake fail the first time
          return res.sendStatus(500);
        }
        return res.status(200).send(fstab);
      });

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a8/hello.md')
      .intercept((_, res) => res.status(200).send('Hello'));
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a8/world.md')
      .intercept((_, res) => res.status(200).send('World'));

    const result1 = await main({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'cb8a0dc5d9d89b800835166783e4130451d3c6a8',
      path: '/hello.md',
    });
    assert.equal(result1.statusCode, 502);

    const result2 = await main({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'cb8a0dc5d9d89b800835166783e4130451d3c6a8',
      path: '/hello.md',
    });

    const result3 = await main({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'cb8a0dc5d9d89b800835166783e4130451d3c6a8',
      path: '/world.md',
    });

    assert.equal(result2.body, 'Hello');
    assert.equal(result3.body, 'World');
    assert.equal(fstabfetches, 2);
  });
});
