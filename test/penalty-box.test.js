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
/* eslint-disable no-console */
const assert = require('assert');
const PenaltyBox = require('../src/penalty-box');

const sleep = (s) => new Promise((res) => {
  setTimeout(res, s * 1000);
});

describe('Test Penalty Box', () => {
  it('No foul, no harm', async () => {
    const box = new PenaltyBox();
    assert.ok(box.ready('player1'));
    assert.ok(box.ready('player2'));
  }).timeout(120000);

  it('Go into the box', async () => {
    const box = new PenaltyBox(3);
    assert.ok(box.ready('player1'));
    assert.ok(box.ready('player2'));

    box.foul('player1');
    await sleep(1);
    console.log('tick');
    assert.ok(!box.ready('player1'));
    assert.ok(box.ready('player2'));
    await sleep(1);
    console.log('tick');
    assert.ok(!box.ready('player1'));
    assert.ok(box.ready('player2'));
    await sleep(1);
    console.log('tick');
    assert.ok(box.ready('player1'));
    assert.ok(box.ready('player2'));
  }).timeout(120000);

  it('Two games at once', async () => {
    const box = new PenaltyBox(3);

    const game1 = async () => {
      await sleep(2);
      console.log('tick');
      box.foul('player1');
      await sleep(2);
      console.log('tick');
      await sleep(2);
      console.log('tick');
      box.foul('player2');
      await sleep(2);
      console.log('tick');
      await sleep(2);
      console.log('tick');
    };

    const game2 = async () => {
      await sleep(2);
      console.log('tock');
      await sleep(1);
      box.foul('player2');
      console.log('tock');
      await sleep(1);
      console.log('tock');
      await sleep(1);
      console.log('tock');
      await sleep(1);
      console.log('tock');
      box.foul('player1');
      await sleep(1);
      console.log('tock');
    };

    const results = [];

    const check = async () => {
      for (let i = 0; i < 15; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(1);
        results.push({
          iteration: i,
          player1: box.ready('player1'),
          player2: box.ready('player2'),
        });
      }
    };
    await Promise.all([game1(), game2(), check()]);

    console.table(results);

    assert.deepStrictEqual(results[0], {
      iteration: 0,
      player1: true,
      player2: true,
    });

    assert.deepStrictEqual(results[1], {
      iteration: 1,
      player1: false,
      player2: true,
    });

    assert.deepStrictEqual(results[2], {
      iteration: 2,
      player1: false,
      player2: false,
    });

    assert.deepStrictEqual(results[8], {
      iteration: 8,
      player1: true,
      player2: true,
    });
  }).timeout(120000);
});
