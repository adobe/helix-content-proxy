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
/* eslint-disable no-console */

const { Request } = require('@adobe/helix-fetch');
const { main } = require('../../src/index.js');

require('dotenv').config();

async function run() {
  const url = new URL('https://adobeioruntime.net/api/v1/web/helix/helix-services/content-proxy@v2');
  url.searchParams.append('owner', 'adobe');
  url.searchParams.append('repo', 'spark-website');
  url.searchParams.append('ref', 'main');
  url.searchParams.append('path', '/');
  url.searchParams.append('lookup', 'https://adobe.sharepoint.com/:w:/r/sites/SparkHelix/_layouts/15/guestaccess.aspx?e=4%3AxSM7pa&at=9&wdLOR=c64EF58AE-CEBB-0540-B444-044062648A17&share=ERMQVuCr7S5FqIBgvCJezO0BUUxpzherbeKSSPYCinf84w');
  // const url = new URL('https://adobeioruntime.net/api/v1/web/helix/helix-services/content-proxy@v2?owner=adobe&repo=theblog&ref=master&path=%2F&lookup=https%3A%2F%2Fadobe.sharepoint.com%2Fsites%2FTheBlog%2F_layouts%2F15%2FDoc.aspx%3Fsourcedoc%3D%257BBFD9A19C-4A68-4DBF-8641-DA2F1283C895%257D%26file%3Dindex.docx%26action%3Ddefault%26mobileredirect%3Dtrue%26cid%3Db6e62d68-f53a-471f-a686-90e69458fdd7');
  // const url = new URL('https://adobeioruntime.net/api/v1/web/helix/helix-services/content-proxy@v2?owner=adobe&repo=theblog&ref=master&path=%2F&lookup=https%3A%2F%2Fadobe.sharepoint.com%2F%3Aw%3A%2Fr%2Fsites%2FTheBlog%2F_layouts%2F15%2FDoc.aspx%3Fsourcedoc%3D%257BBFD9A19C-4A68-4DBF-8641-DA2F1283C895%257D%26file%3Dindex.docx%26action%3Ddefault%26mobileredirect%3Dtrue%26cid%3Db6e62d68-f53a-471f-a686-90e69458fdd7');
  const result = await main(new Request(url), {
    log: console,
    env: process.env,
  });
  console.log(await result.text());
}

run().catch(console.error);
