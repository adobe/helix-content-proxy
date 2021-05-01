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
/* eslint-disable global-require, class-methods-use-this, no-console */
process.env.HELIX_FETCH_FORCE_HTTP1 = 'true';
const assert = require('assert');
const { encrypt } = require('../src/credentials.js');
const { setupPolly, retrofit } = require('./utils.js');
const { main: universalMain } = require('../src/index.js');
const { base64 } = require('../src/utils.js');

const main = retrofit(universalMain);

const fstab = `
mountpoints:
  /ms: https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/theblog
  /gdocs: "https://drive.google.com/drive/folders/1snjgJoqKO71T--uLIAsindAl82FuOtrR"
  /google-home.md: gdrive:1GIItS1y0YXTySslLGqJZUFxwFH1DPlSg3R7ybYY3ATE
`;

const DEFAULT_PARAMS = {
  owner: 'adobe',
  repo: 'theblog',
  ref: 'master',
  path: '/',
};

const DEFAULT_ENV = {
  AZURE_WORD2MD_CLIENT_ID: 'dummy',
  AZURE_WORD2MD_CLIENT_SECRET: 'dummy',
  AZURE_WORD2MD_REFRESH_TOKEN: 'dummy',
};

const DEFAULT_AUTH = {
  token_type: 'Bearer',
  refresh_token: 'dummy',
  access_token: 'dummy',
  expires_in: 81000,
};

describe('Onedrive Reverse Lookup Tests', () => {
  setupPolly({
    recordIfMissing: false,
  });

  it('Returns redirect for onedrive document', async function test() {
    const { server } = this.polly;
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));
    server
      .post('https://login.windows.net/common/oauth2/token?api-version=1.0')
      .intercept((_, res) => res.status(200).send(DEFAULT_AUTH));
    server
      .get('https://graph.microsoft.com/v1.0/sites/adobe.sharepoint.com:/sites/TheBlog:/lists/documents/items/09BFA93A-78BC-49F6-B93D-990A0ED4D55C')
      .intercept((_, res) => res.status(200).send({
        webUrl: 'https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/theblog/en/drafs/article.docx',
      }));

    const result = await main({
      ...DEFAULT_PARAMS,
      lookup: 'https://adobe.sharepoint.com/:w:/r/sites/TheBlog/_layouts/15/Doc.aspx?sourcedoc=%7B09BFA93A-78BC-49F6-B93D-990A0ED4D55C%7D&file=article.docx&action=default&mobileredirect=true',
    }, DEFAULT_ENV);

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://master--theblog--adobe.hlx.page/ms/en/drafs/article');
  });

  it('Returns redirect for onedrive document on private repo', async function test() {
    const { server } = this.polly;
    const REFRESH_TOKEN = 'fake-refresh-token';
    const FAKE_GITHUB_TOKEN = 'my-github-token';
    const creds = encrypt(FAKE_GITHUB_TOKEN, JSON.stringify({ r: REFRESH_TOKEN }));
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/prvedit/fstab.yaml')
      .intercept((req, res) => {
        if (req.headers.authorization !== `token ${FAKE_GITHUB_TOKEN}`) {
          res.status(404).send();
          return;
        }
        res.status(200).send(`
          mountpoints:
            /other: https://adobe.sharepoint.com/sites/other
            /: 
              url: https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/theblog
              credentials: ${creds}
          `);
      });
    server
      .post('https://login.windows.net/common/oauth2/token?api-version=1.0')
      .intercept((req, res) => {
        if (req.body.indexOf(REFRESH_TOKEN) < 0) {
          res.status(401).send();
          return;
        }
        res.status(200).send(DEFAULT_AUTH);
      });
    server
      .get('https://graph.microsoft.com/v1.0/sites/adobe.sharepoint.com:/sites/TheBlog:/lists/documents/items/09BFA93A-78BC-49F6-B93D-990A0ED4D55C')
      .intercept((_, res) => res.status(200).send({
        webUrl: 'https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/theblog/en/drafs/article.docx',
      }));

    const result = await main({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'prvedit',
      path: '/',
      lookup: 'https://adobe.sharepoint.com/:w:/r/sites/TheBlog/_layouts/15/Doc.aspx?sourcedoc=%7B09BFA93A-78BC-49F6-B93D-990A0ED4D55C%7D&file=article.docx&action=default&mobileredirect=true',
    }, {
      ...DEFAULT_ENV,
      GITHUB_TOKEN: FAKE_GITHUB_TOKEN,
    });

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://prvedit--theblog--adobe.hlx.page/en/drafs/article');
  });

  it('Returns redirect for onedrive document (base64)', async function test() {
    const { server } = this.polly;
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));
    server
      .post('https://login.windows.net/common/oauth2/token?api-version=1.0')
      .intercept((_, res) => res.status(200).send(DEFAULT_AUTH));
    server
      .get('https://graph.microsoft.com/v1.0/sites/adobe.sharepoint.com:/sites/TheBlog:/lists/documents/items/09BFA93A-78BC-49F6-B93D-990A0ED4D55C')
      .intercept((_, res) => res.status(200).send({
        webUrl: 'https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/theblog/en/drafs/article.docx',
      }));

    const result = await main({
      ...DEFAULT_PARAMS,
      path: `/hlx_${base64('https://adobe.sharepoint.com/:w:/r/sites/TheBlog/_layouts/15/Doc.aspx?sourcedoc=%7B09BFA93A-78BC-49F6-B93D-990A0ED4D55C%7D&file=article.docx&action=default&mobileredirect=true')}.lnk`,
    }, DEFAULT_ENV);

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://master--theblog--adobe.hlx.page/ms/en/drafs/article');
  });

  it('Returns redirect for onedrive document via sharelink', async function test() {
    const { server } = this.polly;
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));
    server
      .post('https://login.windows.net/common/oauth2/token?api-version=1.0')
      .intercept((_, res) => res.status(200).send(DEFAULT_AUTH));
    server
      .get('https://graph.microsoft.com/v1.0/shares/u!aHR0cHM6Ly9hZG9iZS5zaGFyZXBvaW50LmNvbS86dzovci9zaXRlcy9UaGVCbG9oL19sYXlvdXRzLzE1L2d1ZXN0YWNjZXNzLmFzcHg_ZT00JTNBeFNNN3BhJmF0PTkmd2RMT1I9YzY0RUY1OEFFLUNFQkItMDU0MC1CNDQ0LTA0NDA2MjY0OEExNyZzaGFyZT1FUk1RVnVDcjdTNUZxSUJndkNKZXpPMEJVVXhwemhlcmJlS1NTUFlDaW5mODR3/driveItem')
      .intercept((_, res) => res.status(200).send({
        webUrl: 'https://adobe.sharepoint.com/sites/TheBlog/_layouts/15/Doc.aspx?sourcedoc=%7B09BFA93A-78BC-49F6-B93D-990A0ED4D55C&file=Frictionless%20Resize.docx&action=default&mobileredirect=true',
      }));
    server
      .get('https://graph.microsoft.com/v1.0/sites/adobe.sharepoint.com:/sites/TheBlog:/lists/documents/items/09BFA93A-78BC-49F6-B93D-990A0ED4D55C')
      .intercept((_, res) => res.status(200).send({
        webUrl: 'https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/theblog/en/drafs/article.docx',
      }));

    const result = await main({
      ...DEFAULT_PARAMS,
      lookup: 'https://adobe.sharepoint.com/:w:/r/sites/TheBloh/_layouts/15/guestaccess.aspx?e=4%3AxSM7pa&at=9&wdLOR=c64EF58AE-CEBB-0540-B444-044062648A17&share=ERMQVuCr7S5FqIBgvCJezO0BUUxpzherbeKSSPYCinf84w',
    }, DEFAULT_ENV);

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://master--theblog--adobe.hlx.page/ms/en/drafs/article');
  });

  it('Returns not found for onedrive document via invalid sharelink', async function test() {
    const { server } = this.polly;
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));
    server
      .post('https://login.windows.net/common/oauth2/token?api-version=1.0')
      .intercept((_, res) => res.status(200).send(DEFAULT_AUTH));
    server
      .get('https://graph.microsoft.com/v1.0/shares/u!aHR0cHM6Ly9hZG9iZS5zaGFyZXBvaW50LmNvbS86dzovci9zaXRlcy9UaGVCbG9oL19sYXlvdXRzLzE1L2d1ZXN0YWNjZXNzLmFzcHg_ZT00JTNBeFNNN3BhJmF0PTkmd2RMT1I9YzY0RUY1OEFFLUNFQkItMDU0MC1CNDQ0LTA0NDA2MjY0OEExNyZzaGFyZT1FUk1RVnVDcjdTNUZxSUJndkNKZXpPMEJVVXhwemhlcmJlS1NTUFlDaW5mODR4/driveItem')
      .intercept((_, res) => res.status(404).send());

    const result = await main({
      ...DEFAULT_PARAMS,
      lookup: 'https://adobe.sharepoint.com/:w:/r/sites/TheBloh/_layouts/15/guestaccess.aspx?e=4%3AxSM7pa&at=9&wdLOR=c64EF58AE-CEBB-0540-B444-044062648A17&share=ERMQVuCr7S5FqIBgvCJezO0BUUxpzherbeKSSPYCinf84x',
    }, DEFAULT_ENV);

    assert.equal(result.statusCode, 404);
  });

  it('Returns redirect for onedrive document with no edit mode markers', async function test() {
    const { server } = this.polly;
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));
    server
      .post('https://login.windows.net/common/oauth2/token?api-version=1.0')
      .intercept((_, res) => res.status(200).send(DEFAULT_AUTH));
    server
      .get('https://graph.microsoft.com/v1.0/sites/adobe.sharepoint.com:/sites/TheBlog:/lists/documents/items/09BFA93A-78BC-49F6-B93D-990A0ED4D55C')
      .intercept((_, res) => res.status(200).send({
        webUrl: 'https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/theblog/en/drafs/article.docx',
      }));

    const result = await main({
      ...DEFAULT_PARAMS,
      lookup: 'https://adobe.sharepoint.com/sites/TheBlog/_layouts/15/Doc.aspx?sourcedoc=%7B09BFA93A-78BC-49F6-B93D-990A0ED4D55C%7D&file=article.docx&action=default&mobileredirect=true',
    }, DEFAULT_ENV);

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://master--theblog--adobe.hlx.page/ms/en/drafs/article');
  });

  it('Returns redirect for onedrive document with email sharelink', async function test() {
    const { server } = this.polly;
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));
    server
      .post('https://login.windows.net/common/oauth2/token?api-version=1.0')
      .intercept((_, res) => res.status(200).send(DEFAULT_AUTH));
    server
      .get('https://graph.microsoft.com/v1.0/shares/u!aHR0cHM6Ly9hZG9iZS5zaGFyZXBvaW50LmNvbS86dzovcy9UaGVCbG9nL0VmYVp2OFRYQkt0TmtEYjhNSDFIb09zQm53UnVudjNCeFhaXy1YZ2NFd2lxZXc_ZT1STFNEOFI/driveItem')
      .intercept((_, res) => res.status(200).send({
        webUrl: 'https://adobe.sharepoint.com/sites/TheBlog/_layouts/15/Doc.aspx?sourcedoc=%7B09BFA93A-78BC-49F6-B93D-990A0ED4D55C&file=Frictionless%20Resize.docx&action=default&mobileredirect=true',
      }));
    server
      .get('https://graph.microsoft.com/v1.0/sites/adobe.sharepoint.com:/sites/TheBlog:/lists/documents/items/09BFA93A-78BC-49F6-B93D-990A0ED4D55C')
      .intercept((_, res) => res.status(200).send({
        webUrl: 'https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/theblog/en/drafs/article.docx',
      }));

    const result = await main({
      ...DEFAULT_PARAMS,
      lookup: 'https://adobe.sharepoint.com/:w:/s/TheBlog/EfaZv8TXBKtNkDb8MH1HoOsBnwRunv3BxXZ_-XgcEwiqew?e=RLSD8R',
    }, DEFAULT_ENV);

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://master--theblog--adobe.hlx.page/ms/en/drafs/article');
  });

  it('Returns redirect for onedrive spreadsheet', async function test() {
    const { server } = this.polly;
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));
    server
      .post('https://login.windows.net/common/oauth2/token?api-version=1.0')
      .intercept((_, res) => res.status(200).send(DEFAULT_AUTH));
    server
      .get('https://graph.microsoft.com/v1.0/sites/adobe.sharepoint.com:/sites/TheBlog:/lists/documents/items/1E826007-EDE8-42E1-A8F4-7A5386DE18A4')
      .intercept((_, res) => res.status(200).send({
        webUrl: 'https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/theblog/en/drafs/some-data-test.xlsx',
      }));

    const result = await main({
      ...DEFAULT_PARAMS,
      lookup: 'https://adobe.sharepoint.com/:x:/r/sites/TheBlog/_layouts/15/Doc.aspx?sourcedoc=%7B1E826007-EDE8-42E1-A8F4-7A5386DE18A4%7D&file=some-data-test.xlsx&action=default&mobileredirect=true',
    }, DEFAULT_ENV);

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://master--theblog--adobe.hlx.page/ms/en/drafs/some-data-test.json');
  });

  it('Returns redirect for onedrive taxonomy spreadsheet', async function test() {
    const { server } = this.polly;
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));
    server
      .post('https://login.windows.net/common/oauth2/token?api-version=1.0')
      .intercept((_, res) => res.status(200).send(DEFAULT_AUTH));
    server
      .get('https://graph.microsoft.com/v1.0/sites/adobe.sharepoint.com:/sites/TheBlog:/lists/documents/items/565E00D2-2D27-44B2-9DDA-35D182F0F698')
      .intercept((_, res) => res.status(200).send({
        webUrl: 'https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/theblog/en/topics/_taxonomy.xlsx',
      }));

    const result = await main({
      ...DEFAULT_PARAMS,
      lookup: 'https://adobe.sharepoint.com/:x:/r/sites/TheBlog/_layouts/15/Doc.aspx?sourcedoc=%7B565E00D2-2D27-44B2-9DDA-35D182F0F698%7D&file=_taxonomy.xlsx&action=default&mobileredirect=true',
    }, DEFAULT_ENV);

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://master--theblog--adobe.hlx.page/ms/en/topics/taxonomy.json');
  });

  it('Returns redirect for onedrive document w/o extension', async function test() {
    const { server } = this.polly;
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));
    server
      .post('https://login.windows.net/common/oauth2/token?api-version=1.0')
      .intercept((_, res) => res.status(200).send(DEFAULT_AUTH));
    server
      .get('https://graph.microsoft.com/v1.0/sites/adobe.sharepoint.com:/sites/TheBlog:/lists/documents/items/1E826007-EDE8-42E1-A8F4-7A5386DE18A4')
      .intercept((_, res) => res.status(200).send({
        webUrl: 'https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/theblog/en/drafs/some-data-test',
      }));

    const result = await main({
      ...DEFAULT_PARAMS,
      lookup: 'https://adobe.sharepoint.com/:x:/r/sites/TheBlog/_layouts/15/Doc.aspx?sourcedoc=%7B1E826007-EDE8-42E1-A8F4-7A5386DE18A4%7D&file=some-data-test.xlsx&action=default&mobileredirect=true',
    }, DEFAULT_ENV);

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://master--theblog--adobe.hlx.page/ms/en/drafs/some-data-test');
  });

  it('Returns redirect for onedrive document with author friendly name', async function test() {
    const { server } = this.polly;
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));
    server
      .post('https://login.windows.net/common/oauth2/token?api-version=1.0')
      .intercept((_, res) => res.status(200).send(DEFAULT_AUTH));
    server
      .get('https://graph.microsoft.com/v1.0/sites/adobe.sharepoint.com:/sites/TheBlog:/lists/documents/items/31F3BD97-BD06-455B-939F-C594D1D92371')
      .intercept((_, res) => res.status(200).send({
        webUrl: 'https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/theblog/en/drafts/My%201.%20D%C3%B6cument!.docx',
      }));

    const result = await main({
      ...DEFAULT_PARAMS,
      lookup: 'https://adobe.sharepoint.com/:w:/r/sites/TheBlog/_layouts/15/Doc.aspx?sourcedoc=%7B31F3BD97-BD06-455B-939F-C594D1D92371%7D&file=My%201.%20D%C3%B6cument!.docx&action=default&mobileredirect=true',
    }, DEFAULT_ENV);

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://master--theblog--adobe.hlx.page/ms/en/drafts/my-1-document');
  });

  it('Returns resolve report for onedrive document with author friendly name', async function test() {
    const { server } = this.polly;
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));
    server
      .post('https://login.windows.net/common/oauth2/token?api-version=1.0')
      .intercept((_, res) => res.status(200).send(DEFAULT_AUTH));
    server
      .get('https://graph.microsoft.com/v1.0/sites/adobe.sharepoint.com:/sites/TheBlog:/lists/documents/items/31F3BD97-BD06-455B-939F-C594D1D92371')
      .intercept((_, res) => res.status(200).send({
        webUrl: 'https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/theblog/en/drafts/My%201.%20D%C3%B6cument!.docx',
      }));

    const result = await main({
      ...DEFAULT_PARAMS,
      report: 'true',
      lookup: 'https://adobe.sharepoint.com/:w:/r/sites/TheBlog/_layouts/15/Doc.aspx?sourcedoc=%7B31F3BD97-BD06-455B-939F-C594D1D92371%7D&file=My%201.%20D%C3%B6cument!.docx&action=default&mobileredirect=true',
    }, DEFAULT_ENV);

    assert.equal(result.statusCode, 200);
    result.body = JSON.parse(result.body);
    assert.deepEqual(result.body, {
      sourceUrl: 'https://adobe.sharepoint.com/:w:/r/sites/TheBlog/_layouts/15/Doc.aspx?sourcedoc=%7B31F3BD97-BD06-455B-939F-C594D1D92371%7D&file=My%201.%20D%C3%B6cument!.docx&action=default&mobileredirect=true',
      webUrl: 'https://master--theblog--adobe.hlx.page/ms/en/drafts/my-1-document',
      unfriendlyWebUrl: 'https://master--theblog--adobe.hlx.page/ms/en/drafts/My%201.%20D%C3%B6cument!',
    });
  });

  it('Returns resolve hlx_report for onedrive document with author friendly name', async function test() {
    const { server } = this.polly;
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));
    server
      .post('https://login.windows.net/common/oauth2/token?api-version=1.0')
      .intercept((_, res) => res.status(200).send(DEFAULT_AUTH));
    server
      .get('https://graph.microsoft.com/v1.0/sites/adobe.sharepoint.com:/sites/TheBlog:/lists/documents/items/31F3BD97-BD06-455B-939F-C594D1D92371')
      .intercept((_, res) => res.status(200).send({
        webUrl: 'https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/theblog/en/drafts/My%201.%20D%C3%B6cument!.docx',
      }));

    const result = await main({
      ...DEFAULT_PARAMS,
      __ow_headers: {
        origin: 'https://my-adobe.sharepoint.com',
      },
      hlx_report: 'true',
      lookup: 'https://adobe.sharepoint.com/:w:/r/sites/TheBlog/_layouts/15/Doc.aspx?sourcedoc=%7B31F3BD97-BD06-455B-939F-C594D1D92371%7D&file=My%201.%20D%C3%B6cument!.docx&action=default&mobileredirect=true',
    }, DEFAULT_ENV);

    assert.equal(result.statusCode, 200);
    result.body = JSON.parse(result.body);
    assert.deepEqual(result.body, {
      sourceUrl: 'https://adobe.sharepoint.com/:w:/r/sites/TheBlog/_layouts/15/Doc.aspx?sourcedoc=%7B31F3BD97-BD06-455B-939F-C594D1D92371%7D&file=My%201.%20D%C3%B6cument!.docx&action=default&mobileredirect=true',
      webUrl: 'https://master--theblog--adobe.hlx.page/ms/en/drafts/my-1-document',
      unfriendlyWebUrl: 'https://master--theblog--adobe.hlx.page/ms/en/drafts/My%201.%20D%C3%B6cument!',
    });

    // check cors headers
    assert.equal(result.headers['access-control-allow-origin'], 'https://my-adobe.sharepoint.com');
    assert.equal(result.headers['access-control-allow-methods'], 'GET, HEAD, OPTIONS');
  });

  it('Returns resolve does not set cors headers for wrong origin', async function test() {
    const { server } = this.polly;
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));
    server
      .post('https://login.windows.net/common/oauth2/token?api-version=1.0')
      .intercept((_, res) => res.status(200).send(DEFAULT_AUTH));
    server
      .get('https://graph.microsoft.com/v1.0/sites/adobe.sharepoint.com:/sites/TheBlog:/lists/documents/items/31F3BD97-BD06-455B-939F-C594D1D92371')
      .intercept((_, res) => res.status(200).send({
        webUrl: 'https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/theblog/en/drafts/My%201.%20D%C3%B6cument!.docx',
      }));

    const result = await main({
      ...DEFAULT_PARAMS,
      __ow_headers: {
        origin: 'https://my-adobe.sharepoent.com',
      },
      hlx_report: 'true',
      lookup: 'https://adobe.sharepoint.com/:w:/r/sites/TheBlog/_layouts/15/Doc.aspx?sourcedoc=%7B31F3BD97-BD06-455B-939F-C594D1D92371%7D&file=My%201.%20D%C3%B6cument!.docx&action=default&mobileredirect=true',
    }, DEFAULT_ENV);

    assert.equal(result.statusCode, 200);
    result.body = JSON.parse(result.body);
    assert.deepEqual(result.body, {
      sourceUrl: 'https://adobe.sharepoint.com/:w:/r/sites/TheBlog/_layouts/15/Doc.aspx?sourcedoc=%7B31F3BD97-BD06-455B-939F-C594D1D92371%7D&file=My%201.%20D%C3%B6cument!.docx&action=default&mobileredirect=true',
      webUrl: 'https://master--theblog--adobe.hlx.page/ms/en/drafts/my-1-document',
      unfriendlyWebUrl: 'https://master--theblog--adobe.hlx.page/ms/en/drafts/My%201.%20D%C3%B6cument!',
    });

    // check cors headers
    assert.equal(result.headers['access-control-allow-origin'], undefined);
    assert.equal(result.headers['access-control-allow-methods'], undefined);
  });

  it('Returns redirect for onedrive file', async function test() {
    const { server } = this.polly;
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      ...DEFAULT_PARAMS,
      lookup: 'https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/Forms/AllItems.aspx?FolderCTID=0x012000291CC2F215041D41ADE01F0A04AB94F2&id=%2Fsites%2FTheBlog%2FShared%20Documents%2Ftheblog%2Fen%2Fdrafts%2Ftheblog%2Dembeds%2Emd&parent=%2Fsites%2FTheBlog%2FShared%20Documents%2Ftheblog%2Fen%2Fdrafts',
    }, DEFAULT_ENV);

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://master--theblog--adobe.hlx.page/ms/en/drafts/theblog-embeds');
  });

  it('Returns redirect for onedrive file on different sharepoint site', async function test() {
    const { server } = this.polly;
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));

    const result = await main({
      ...DEFAULT_PARAMS,
      lookup: 'https://adobe-my.sharepoint.com/personal/tripod_adobe_com/_layouts/15/onedrive.aspx?listurl=https%3A%2F%2Fadobe%2Esharepoint%2Ecom%2Fsites%2FTheBlog%2FShared%20Documents&id=%2Fsites%2FTheBlog%2FShared%20Documents%2Ftheblog%2Fen%2Fpublish%2F2020%2F07%2F28%2Fin%2Dcomplex%2Dtimes%2Dpanasonic%2Dmade%2Dits%2Db2b%2Dmarketing%2Dsimple%2Emd&parent=%2Fsites%2FTheBlog%2FShared%20Documents%2Ftheblog%2Fen%2Fpublish%2F2020%2F07%2F28',
    }, DEFAULT_ENV);

    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location, 'https://master--theblog--adobe.hlx.page/ms/en/publish/2020/07/28/in-complex-times-panasonic-made-its-b2b-marketing-simple');
  });

  it('Returns 404 for a document not below a mountpoint', async function test() {
    const { server } = this.polly;
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));
    server
      .post('https://login.windows.net/common/oauth2/token?api-version=1.0')
      .intercept((_, res) => res.status(200).send(DEFAULT_AUTH));
    server
      .get('https://graph.microsoft.com/v1.0/sites/adobe.sharepoint.com:/sites/cg-helix:/lists/documents/items/DA2CD648-31DE-4913-B4C3-1AB149C8DD9C')
      .intercept((_, res) => res.status(200).send({
        webUrl: 'https://adobe.sharepoint.com/sites/cg-helix/Shared%20Documents/word2md-unit-tests/another-test-document.docx',
      }));

    const result = await main({
      ...DEFAULT_PARAMS,
      lookup: 'https://adobe.sharepoint.com/:w:/r/sites/cg-helix/_layouts/15/Doc.aspx?sourcedoc=%7BDA2CD648-31DE-4913-B4C3-1AB149C8DD9C%7D&file=another-test-document.docx&action=default&mobileredirect=true',
    }, DEFAULT_ENV);

    assert.equal(result.statusCode, 404);
  });

  it('Returns 404 for a document on different sharepoint host', async function test() {
    const { server } = this.polly;
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));
    server
      .post('https://login.windows.net/common/oauth2/token?api-version=1.0')
      .intercept((_, res) => res.status(200).send(DEFAULT_AUTH));
    server
      .get('https://graph.microsoft.com/v1.0/sites/adobe-my.sharepoint.com:/personal/tripod_adobe_com:/lists/documents/items/1A0E1E5C-E3A6-4E89-A547-D54043DBB648')
      .intercept((_, res) => res.status(200).send({
        webUrl: 'https://adobe-my.sharepoint.com/personal/tripod_adobe_com/Document.docx',
      }));

    const result = await main({
      ...DEFAULT_PARAMS,
      lookup: 'https://adobe-my.sharepoint.com/:w:/r/personal/tripod_adobe_com/_layouts/15/Doc.aspx?sourcedoc=%7B1A0E1E5C-E3A6-4E89-A547-D54043DBB648%7D&file=Document.docx&action=default&mobileredirect=true',
    }, DEFAULT_ENV);

    assert.equal(result.statusCode, 404);
  });

  it('Returns 404 for an error while resolving list item', async function test() {
    const { server } = this.polly;
    server
      .get('https://raw.githubusercontent.com/adobe/theblog/master/fstab.yaml')
      .intercept((_, res) => res.status(200).send(fstab));
    server
      .post('https://login.windows.net/common/oauth2/token?api-version=1.0')
      .intercept((_, res) => res.status(200).send(DEFAULT_AUTH));
    server
      .get('https://graph.microsoft.com/v1.0/sites/adobe.sharepoint.com:/sites/cg-helix:/lists/documents/items/DA2CD648-31DE-4913-B4C3-1AB149C8DD9C')
      .intercept((_, res) => res.status(500));

    const result = await main({
      ...DEFAULT_PARAMS,
      lookup: 'https://adobe.sharepoint.com/:w:/r/sites/cg-helix/_layouts/15/Doc.aspx?sourcedoc=%7BDA2CD648-31DE-4913-B4C3-1AB149C8DD9C%7D&file=another-test-document.docx&action=default&mobileredirect=true',
    }, DEFAULT_ENV);

    assert.equal(result.statusCode, 404);
  });
});
