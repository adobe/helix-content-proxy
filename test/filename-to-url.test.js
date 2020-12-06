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

const assert = require('assert');
const { filename2url } = require('../src/filename-to-url.js');

describe('filename2url Tests', () => {
  it('filename2url works for empty string', () => {
    assert.equal(filename2url(''), '');
  });

  it('filename2url transform string to lower case', () => {
    assert.equal(filename2url('MyDocument'), 'mydocument');
  });

  it('filename2url can ignore extension', () => {
    assert.equal(filename2url('.MyDocument', {
      ignoreExtension: true,
    }), 'mydocument');
  });

  it('filename2url works with dots in path and no extension', () => {
    assert.equal(filename2url('/foo.bar/My Document'), '/foo.bar/my-document');
  });

  it('filename2url only transforms last path segment', () => {
    assert.equal(filename2url('/Untitled Folder/MyDocument'), '/Untitled Folder/mydocument');
  });

  it('filename2url only transforms root segment', () => {
    assert.equal(filename2url('/MyDocument'), '/mydocument');
  });

  it('filename2url transforms non-alpha to dashes', () => {
    assert.equal(filename2url('My 2. Document.docx'), 'my-2-document.docx');
  });

  it('filename2url removes leading dashes', () => {
    assert.equal(filename2url('.My 2. Document.docx'), 'my-2-document.docx');
  });

  it('filename2url removes trailing dashes', () => {
    assert.equal(filename2url('.My 2. Document!.docx'), 'my-2-document.docx');
  });

  it('filename2url normalizes unicode', () => {
    assert.equal(filename2url('Föhren Smürd'), 'fohren-smurd');
  });
});
