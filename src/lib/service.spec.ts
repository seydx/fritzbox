import anyTest, { TestInterface, serial } from 'ava'

const test = serial as TestInterface<{}>

import { load } from 'nock'

import { Service } from './service'
import { URL } from 'url'

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

test('can execute service with https', async t => {
  const service = new Service(
    {
      serviceType: 'urn:dslforum-org:service:Hosts:1',
      serviceId: 'urn:LanDeviceHosts-com:serviceId:Hosts1',
      controlURL: '/upnp/control/hosts',
      eventSubURL: '/upnp/control/hosts',
      SCPDURL: '/hostsSCPD.xml',
    },
    new URL('https://test:testPwd123@fritz.box:49443')
  )
  const scope = load(__dirname + '/testdata/Hosts_1_ssl.json')

  return service
    .initialize()
    .then(() => service.execAction('GetHostNumberOfEntries'))
    .then(result => {
      t.deepEqual(result, {
        NewHostNumberOfEntries: '999',
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
