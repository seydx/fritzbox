import anyTest, { TestInterface, serial } from 'ava'

const test = serial as TestInterface<{ fb: Fritzbox }>

import * as nock from 'nock'

import { back } from 'nock'

import { Fritzbox } from './fritzbox'
import { take, tap, toArray, startWith } from 'rxjs/operators'
import { fstat, writeFileSync } from 'fs'
import { request } from './request'

test.before(() => {})

test.beforeEach(async t => {
  const scope = nock.load(__dirname + '/testdata/fritzbox.json')

  const fb = new Fritzbox({
    username: 'test',
    password: 'testPwd123',
    autoSsl: false,
  })
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
  const fb = new Fritzbox({
    username: 'test',
    password: 'testPwd123',
    autoSsl: false,
  })

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

  const fb = new Fritzbox({
    username: 'test',
    password: 'testPwd123',
    autoSsl: false,
  })

  return fb.initialize().then(() =>
    t.context.fb.getAllHosts().then(result => {
      t.is(result.length, 16)
      t.deepEqual(result[7], {
        active: true,
        interface: '802.11',
        ip: '10.1.2.54',
        mac: '40:30:04:4F:40:20',
        name: 'johns-iPad-2',
      })
    })
  )
})

test('can describe fritzbox', async t => {
  const scope = nock.load(__dirname + '/testdata/description.json')

  const result = await t.context.fb.describe()
  t.snapshot(result)
})

test.cb('can observe events', t => {
  t.plan(2)
  const fb = new Fritzbox({
    username: 'test',
    password: 'testPwd123',
    eventAddress: '127.0.0.1',
    eventPort: 9999,
    autoSsl: false,
  })

  const scope = nock.load(__dirname + '/testdata/observe.json')
  const prom1 = fb
    .observe()
    .pipe(take(1))
    .toPromise()
    .then(data => {
      t.log('Recevied 1')
      t.deepEqual(data, {
        data: '67',
        event: 'HostNumberOfEntries',
        service: 'urn:dslforum-org:service:WLANConfiguration:2',
        sid: 'uuid:22fae32c-1dd2-11b2-9ee6-f7077a861cd8',
      })
    })
    .catch(e => {
      t.fail('Catched error 1')
    })

  const prom2 = fb
    .observe()
    .pipe(take(1))
    .subscribe(
      data => {
        t.log('Recevied 2')
        t.deepEqual(data, {
          data: '67',
          event: 'HostNumberOfEntries',
          service: 'urn:dslforum-org:service:WLANConfiguration:2',
          sid: 'uuid:22fae32c-1dd2-11b2-9ee6-f7077a861cd8',
        })
      },
      err => {
        console.log(err)
        t.fail('Catched error')
      }
    )
  Promise.all([prom1, prom2]).then(() => t.end())

  setTimeout(() => {
    nock.restore()

    t.log('Posting events')

    request({
      method: 'POST',
      uri: 'http://127.0.0.1:9999',
      headers: {
        nt: 'upnp:event',
        nts: 'upnp:propchane',
        sid: 'uuid:22fae32c-1dd2-11b2-9ee6-f7077a861cd8',
        seq: '0',
      },
      body:
        '<?xml version="1.0"?>\n' +
        '<e:propertyset xmlns:e="urn:dslforum-org:event-1-0">\n' +
        '<e:property>\n' +
        '<HostNumberOfEntries>67</HostNumberOfEntries></e:property>\n' +
        /*'<e:property>\n' +
        '<X_AVM-DE_ChangeCounter>0</X_AVM-DE_ChangeCounter></e:property>\n' +*/
        '</e:propertyset>\n' +
        '\u0000',
    }).catch(e => {
      console.error(e)
    })
  }, 500)
})

test('security port', async t => {
  nock.cleanAll()
  nock.load(__dirname + '/testdata/fritzbox.json')

  const fb = new Fritzbox({
    username: 'test',
    password: 'testPwd123',
    autoSsl: true,
  })

  t.is(fb.url.port, '49000')

  return fb
    .initialize()

    .then(() => {
      t.is(fb.url.port, '49443')
    })
})
