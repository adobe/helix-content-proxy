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
    it('The blog index', async () => {
      const url = `${target.urlPath()}?owner=adobe&repo=theblog&ref=master&path=/index.md`;
      await chai
        .request(target.host())
        .get(url)
        .then((response) => {
          expect(response).to.have.status(200);
          expect(response).to.be.text;
          expect(response.headers['content-type'].toLowerCase()).to.be.eql('text/plain; charset=utf-8');
          expect(response.text).to.be.a('string').that.includes('# The Blog | Welcome to Adobe Blog');
        }).catch((e) => {
          e.message = `At ${url}\n      ${e.message}`;
          throw e;
        });
    }).timeout(40000);

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
    }).timeout(40000);

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
    }).timeout(40000);

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
    }).timeout(40000);

    it('Compute Edit Lookup', async () => {
      const url = `${target.urlPath()}?owner=adobe&repo=theblog&ref=master&path=%2F&edit=https%3A%2F%2Fblog.adobe.com%2Fen%2F2020%2F12%2F01%2Fwhat-does-the-cmo50-tell-us-about-modern-marketing.html%23gs.re0ega`;
      await chai
        .request(target.host())
        .get(url)
        .then((response) => {
          expect(response).to.have.status(404);
        }).catch((e) => {
          e.message = `At ${target.host()}${url}\n      ${e.message}`;
          throw e;
        });
    }).timeout(40000);

    it('Compute Edit Lookup with lnk', async () => {
      const url = `${target.urlPath()}?owner=adobe&repo=theblog&ref=master&path=%2Fen%2F2020%2F12%2F01%2Fwhat-does-the-cmo50-tell-us-about-modern-marketing.lnk`;
      await chai
        .request(target.host())
        .get(url)
        .then((response) => {
          expect(response).to.have.status(404);
        }).catch((e) => {
          e.message = `At ${target.host()}${url}\n      ${e.message}`;
          throw e;
        });
    }).timeout(40000);

    it('Downloads sitemap.xml from onedrive', async function test() {
      if (target.title() === 'OpenWhisk') {
        // this currently fails on openwhisk because the response is too large
        this.skip();
        return;
      }

      const url = `${target.urlPath()}?owner=adobe&repo=helix-content-proxy&ref=03d2eb05046e6e4681ff01c3a0dcd0e92ba987fe&path=/m/sitemap.xml`;
      await chai
        .request(target.host())
        .get(url)
        .buffer()
        .then((response) => {
          expect(response).to.have.status(200);
          expect(response.headers['content-type']).to.equal('application/xml');
          expect(response.text).to.contain('<loc>https://blog.adobe.com/en/publish/2021/02/23/advocates-family-life.html</loc>');
        })
        .catch((e) => {
          e.message = `At ${target.host()}${url}\n      ${e.message}`;
          throw e;
        });
    }).timeout(40000);

    it('Downloads sitemap.xml from gdrive', async function test() {
      if (target.title() === 'OpenWhisk') {
        // this currently fails on openwhisk because the response is too large
        this.skip();
        return;
      }

      const url = `${target.urlPath()}?owner=adobe&repo=helix-content-proxy&ref=03d2eb05046e6e4681ff01c3a0dcd0e92ba987fe&path=/g/sitemap.xml`;
      await chai
        .request(target.host())
        .get(url)
        .buffer()
        .then((response) => {
          expect(response).to.have.status(200);
          expect(response.headers['content-type']).to.equal('application/xml');
          expect(response.text).to.contain('<loc>https://blog.adobe.com/en/publish/2021/02/23/advocates-family-life.html</loc>');
        })
        .catch((e) => {
          e.message = `At ${target.host()}${url}\n      ${e.message}`;
          throw e;
        });
    }).timeout(40000);
  });
});
