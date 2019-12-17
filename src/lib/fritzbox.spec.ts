import anyTest, { TestInterface, serial } from 'ava'

const test = serial as TestInterface<{ fb: Fritzbox }>

import * as nock from 'nock'

import { back } from 'nock'

import { Fritzbox } from './fritzbox'

test.before(() => {})

test.beforeEach(async t => {
  const scope = nock.load(__dirname + '/testdata/fritzbox.json')

  const fb = new Fritzbox({ username: 'test', password: 'testPwd123' })
  return fb.initialize().then(() => {
    t.context.fb = fb
  })
})
test.afterEach(t => {})

test('can instantiate', t => {
  t.is(t.context.fb.url.origin, 'http://fritz.box:49000')
  t.is(t.context.fb.serviceCount, 39)
})

test('can execute service', async t => {
  const scope = nock.load(__dirname + '/testdata/getdeviceinfo.json')

  const fb = t.context.fb
  return fb
    .exec('urn:dslforum-org:service:DeviceInfo:1', 'GetInfo')
    .then(result => {
      t.deepEqual(result, {
        NewDescription: 'FRITZ!Box 7490 (UI) 113.07.12',
        NewDeviceLog: 'LOGFILE',
        NewHardwareVersion: 'FRITZ!Box 7490 (UI)',
        NewManufacturerName: 'AVM',
        NewManufacturerOUI: '00040E',
        NewModelName: 'FRITZ!Box 7490 (UI)',
        NewProductClass: 'FRITZ!Box',
        NewProvisioningCode: '012.000.000.000',
        NewSerialNumber: 'XXXXXXX',
        NewSoftwareVersion: '113.07.12',
        NewSpecVersion: '1.0',
        NewUpTime: '7536398',
      })
    })
})

test('failing with unexisting service', async t => {
  const fb = t.context.fb
  await t.throwsAsync(
    fb.exec('unknownservice', 'GetInfo'),
    /service with id unknownservice not known/
  )
})

test('Getting host infos', async t => {
  const scope = nock.load(__dirname + '/testdata/gethosts.json')
  const fb = new Fritzbox({ username: 'test', password: 'testPwd123' })

  return fb.initialize().then(() =>
    t.context.fb
      .getHostInfos('88:AE:07:43:2A:EB', '00:1A:22:02:B7:EA')
      .then(result => {
        t.deepEqual(result, [
          {
            active: true,
            interface: '802.11',
            ip: '10.1.2.59',
            mac: '88:AE:07:43:2A:EB',
            name: 'iPad-2',
          },
          {
            active: true,
            interface: 'Ethernet',
            ip: '10.1.2.10',
            mac: '00:1A:22:02:B7:EA',
            name: 'homematic',
          },
        ])
      })
  )
})

test('Getting allhost infos', async t => {
  const scope = nock.load(__dirname + '/testdata/gethosts.json')

  const fb = new Fritzbox({ username: 'test', password: 'testPwd123' })

  return fb.initialize().then(() =>
    t.context.fb.getAllHosts().then(result => {
      t.is(result.length, 16)
      t.deepEqual(result[8], {
        active: true,
        interface: '802.11',
        ip: '10.1.2.54',
        mac: '40:30:04:4F:40:20',
        name: 'johns-iPad-2',
      })
    })
  )
})
