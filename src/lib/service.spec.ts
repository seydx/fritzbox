import anyTest, { TestInterface, serial } from 'ava'

const test = serial as TestInterface<{}>

import { load, back } from 'nock'

import { Service } from './service'
import { URL } from 'url'
import { inspect } from 'util'
import { install } from 'lolex'

test('can execute service', async t => {
  const service = new Service(
    {
      serviceType: 'urn:dslforum-org:service:Hosts:1',
      serviceId: 'urn:LanDeviceHosts-com:serviceId:Hosts1',
      controlURL: '/upnp/control/hosts',
      eventSubURL: '/upnp/control/hosts',
      SCPDURL: '/hostsSCPD.xml',
    },
    new URL('http://test:testPwd123@fritz.box:49000')
  )
  const scope = load(__dirname + '/testdata/Hosts_1.json')

  return service
    .initialize()
    .then(() => service.execAction('GetHostNumberOfEntries'))
    .then(result => {
      t.deepEqual(result, {
        NewHostNumberOfEntries: '999',
      })
    })
})

test('can get info service', async t => {
  const service = new Service(
    {
      serviceType: 'urn:dslforum-org:service:DeviceInfo:1',
      serviceId: 'urn:DeviceInfo-com:serviceId:DeviceInfo1',
      controlURL: '/upnp/control/deviceinfo',
      eventSubURL: '/upnp/control/deviceinfo',
      SCPDURL: '/deviceinfoSCPD.xml',
    },
    new URL('http://test:testPwd123@fritz.box:49000')
  )
  const scope = load(__dirname + '/testdata/getdeviceinfo.json')

  return service
    .initialize()
    .then(() => service.execAction('GetInfo'))
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

test('can execute service with empty actions', async t => {
  const service = new Service(
    {
      serviceType: 'urn:mysimpleservice',
      serviceId: 'urn:mysimpleserviceId',
      controlURL: '/upnp/control/simple',
      eventSubURL: '/upnp/control/simple',
      SCPDURL: '/simpleSCPD.xml',
    },
    new URL('http://test:testPwd123@fritz.box:49000')
  )

  const scope = load(__dirname + '/testdata/simple.json')

  await service.initialize()

  await t.throwsAsync(
    service.execAction('unknownAction'),
    /action unknownAction of urn:mysimpleservice not known/
  )
})

test('can describe a service', async t => {
  const service = new Service(
    {
      serviceType: 'urn:mysimpleservice',
      serviceId: 'urn:mysimpleserviceId',
      controlURL: '/upnp/control/simple',
      eventSubURL: '/upnp/control/simple',
      SCPDURL: '/simpleSCPD.xml',
    },
    new URL('http://test:testPwd123@fritz.box:49000')
  )

  const scope = load(__dirname + '/testdata/simple.json')

  const description = await service.describe()
  t.snapshot(description)
})

test('can subscribe and unsubscribe', async t => {
  const scope = load(__dirname + '/testdata/subunsub.json')
  const clock = install()
  const service = new Service(
    {
      serviceType: 'urn:dslforum-org:service:Hosts:1',
      serviceId: 'urn:LanDeviceHosts-com:serviceId:Hosts1',
      controlURL: '/upnp/control/hosts',
      eventSubURL: '/upnp/control/hosts',
      SCPDURL: '/hostsSCPD.xml',
    },
    new URL('http://test:testPwd123@fritz.box:49000')
  )

  await service.initialize()
  t.false(service.subcriptionActive)
  const result = await service.subscribe('127.0.0.1:1234')
  t.deepEqual(result, {
    sid: 'uuid:1026b8aa-1dd2-11b2-9ee1-f7077a861cd8',
    timeout: 'Second-1801',
  })

  t.is(service.sid, 'uuid:1026b8aa-1dd2-11b2-9ee1-f7077a861cd8')
  t.true(service.subcriptionActive)
  clock.tick(2000000)
  t.is(service.sid, 'uuid:1026b8aa-1dd2-11b2-9ee1-f7077a861cd8')
  t.true(service.subcriptionActive)

  service.unsubscribe()
  t.false(service.subcriptionActive)
  t.is(service.sid, undefined)
  clock.tick(2000000)
  t.false(service.subcriptionActive)
  t.is(service.sid, undefined)
  service.unsubscribe()
  clock.uninstall()
})
