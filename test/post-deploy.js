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
/* eslint-disable no-unused-expressions */

const chai = require('chai');
const chaiHttp = require('chai-http');
const { createTargets } = require('./post-deploy-utils.js');

chai.use(chaiHttp);
const { expect } = chai;

createTargets().forEach((target) => {
  describe(`Post-Deploy Tests (${target.title()})`, () => {
    it('Helix Pages README', async () => {
      const url = `${target.urlPath()}?owner=adobe&repo=helix-pages&ref=17e0aeeb8639b8dae1c9243cf9fbd0042f564750&path=index.md`;
      await chai
        .request(target.host())
        .get(url)
        .then((response) => {
          expect(response).to.have.status(200);
          expect(response).to.be.text;
          expect(response.text).to.be.a('string').that.includes('Welcome to Helix Pages!');
        }).catch((e) => {
          e.message = `At ${url}\n      ${e.message}`;
          throw e;
        });
    }).timeout(20000);

    it('Helix The Blog Excel', async () => {
      const url = `${target.urlPath()}?owner=adobe&repo=theblog&ref=master&path=/en/drafts/some-data-test.json&limit=1`;
      await chai
        .request(target.host())
        .get(url)
        .then((response) => {
          expect(response).to.have.status(200);
          expect(response).to.be.json;
          expect(response.body.data).to.be.an('array');
          expect(response.body.data).to.have.a.lengthOf(1);
        }).catch((e) => {
          e.message = `At ${url}\n      ${e.message}`;
          throw e;
        });
    }).timeout(20000);

    it('Helix The Blog Excel with Query Builder', async () => {
      const url = `${target.urlPath()}?owner=adobe&repo=theblog&ref=master&path=/en/drafts/some-data-test.json&hlx_rangeproperty.property=and&hlx_rangeproperty.lowerBound=1`;
      await chai
        .request(target.host())
        .get(url)
        .then((response) => {
          expect(response).to.have.status(200);
          expect(response).to.be.json;
          expect(response.body.data).to.be.an('array');
          expect(response.body.data).to.have.a.lengthOf(3);
        }).catch((e) => {
          e.message = `At ${url}\n      ${e.message}`;
          throw e;
        });
    }).timeout(20000);
  });
});
