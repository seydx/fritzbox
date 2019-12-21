import anyTest, { TestInterface, serial } from 'ava'

const test = serial as TestInterface<{ fb: Fritzbox }>

import * as nock from 'nock'

import { back } from 'nock'

import { Fritzbox } from './fritzbox'
import { take, tap, toArray, startWith } from 'rxjs/operators'
import { request } from './request'

test('security port', async t => {
  t.log('Sec Port')

  // nock.load(__dirname + '/testdata/fritzbox2.json')

  back.fixtures = __dirname + '/testdata/'
  back.setMode('record')

  const fb = new Fritzbox({
    username: 'test',
    password: 'testPwd123',
    autoSsl: true,
  })

  t.is(fb.url.port, '49000')

  return back('secport.json').then(({ nockDone }) => {
    return fb
      .initialize()

      .then(() => {
        t.is(fb.url.port, '49443')
        nockDone()
      })
  })
})
