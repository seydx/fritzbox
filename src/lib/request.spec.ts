import anyTest, { TestInterface } from 'ava'

const test = anyTest as TestInterface<{}>

import * as nock from 'nock'

import { request } from './request'

test('can request with errorstatus', async t => {
  // unfortunatly nock does not allow to set the status message, so null is returned
  const scope = nock('http://www.example.com')
    .get('/resource')
    .reply(404, 'intendend problem')

  await t.throwsAsync(
    request({ method: 'GET', url: 'http://www.example.com/resource' }),
    'Invalid response: 404:null'
  )
})

test('can request with erroring request', async t => {
  // unfortunatly nock does not allow to set the status message, so null is returned
  const scope = nock('http://www.example.com')
    .get('/resource')
    .replyWithError('intendend problem')

  await t.throwsAsync(
    request({ method: 'GET', url: 'http://www.example.com/resource' }),
    'intendend problem'
  )
})
