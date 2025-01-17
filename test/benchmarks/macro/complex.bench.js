/*
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 * Modifications Copyright OpenSearch Contributors. See
 * GitHub history for details.
 */

'use strict'

// This file must be run with --max-old-space-size=8192
// because we need more than 1Gb of memory
// eg: node --max-old-space-size=8192 complex.bench.js

const { Client } = require('../../../index')
const { statSync, createReadStream } = require('fs')
const { join } = require('path')
const split = require('split2')
const { bench, beforeEach, afterEach } = require('../suite')({
  report: {
    url: process.env.OPENSEARCH_RESULT_CLUSTER_URL,
    username: process.env.OPENSEARCH_RESULT_CLUSTER_USERNAME,
    password: process.env.OPENSEARCH_RESULT_CLUSTER_PASSWORD
  }
})

let stackoverflow = []
const stackoverflowPath = join(
  __dirname,
  'fixtures',
  'stackoverflow.json'
)
const stackoverflowInfo = {
  name: 'stackoverflow.json',
  size: statSync(join(stackoverflowPath)).size,
  num_documents: 2000000
}

const INDEX = 'stackoverflow'
const node = process.env.OPENSEARCH_URL || 'http://localhost:9200'

const client = new Client({ node })

beforeEach(async b => {
  if (stackoverflow.length === 0) {
    stackoverflow = await readSOfile()
  }
  b.client = client
  await b.client.indices.delete({ index: 'test-*' })
})

afterEach(async b => {
  await b.client.indices.delete({ index: 'test-*' })
})

bench('Bulk index documents', {
  warmup: 1,
  measure: 1,
  iterations: 1,
  dataset: stackoverflowInfo,
  action: 'bulk'
}, async b => {
  b.start()
  for (let i = 0; i < stackoverflow.length; i++) {
    await b.client.bulk({ body: stackoverflow[i] })
  }
  b.end()
})

bench('Complex search request', {
  warmup: 3,
  measure: 5,
  iterations: 100,
  dataset: stackoverflowInfo,
  action: 'search'
}, async b => {
  b.start()
  for (let i = 0; i < b.iterations; i++) {
    await b.client.search({
      index: INDEX,
      body: {
        query: {
          match: { title: 'safe' }
        }
      }
    })
  }
  b.end()
})

function readSOfile () {
  let i = 0
  const stackoverflow = []
  return new Promise((resolve, reject) => {
    createReadStream(stackoverflowPath)
      .pipe(split(JSON.parse))
      .on('data', chunk => {
        stackoverflow[i] = stackoverflow[i] || []
        stackoverflow[i].push({ index: { _index: INDEX } })
        stackoverflow[i].push(chunk)
        // 10k documents
        if (stackoverflow[i].length >= 10000 * 2) {
          i++
        }
      })
      .on('error', reject)
      .on('end', () => resolve(stackoverflow))
  })
}
