import { requestXml } from './request'

import { defaults } from 'underscore'
import { Service } from './service'
import { Device, FritzboxOptions, isServiceList, isDeviceList } from './model'
import Debug from 'debug'

import { URL } from 'url'
const debug = Debug('ulfalfa:fritz:device')

const TR064_DESC_URL = '/tr64desc.xml'
const IGD_DESC_URL = '/igddesc.xml'

const DEFAULTS: FritzboxOptions = {
  url: 'http://fritz.box:49000',

  username: undefined,
  password: undefined,
}

export interface HostDescription {
  mac: string
  ip: string
  active: boolean
  name: string
  interface: string
}

export class Fritzbox {
  services: Map<string, Service> = new Map()
  devices: Map<string, Device> = new Map()

  readonly options: FritzboxOptions
  readonly url: URL

  get serviceCount() {
    return this.services.size
  }

  constructor(options?: Partial<FritzboxOptions>) {
    this.options = defaults({}, options, DEFAULTS)

    debug('Options set', this.options)

    this.url = new URL(this.options.url)

    this.url.password = this.options.password
    this.url.username = this.options.username

    debug('Using url', this.url.toString())
  }

  async initialize() {
    await this._parseDesc(TR064_DESC_URL)
    await this._parseDesc(IGD_DESC_URL)
  }

  _getServices(device: Device) {
    const serviceList = device.serviceList
    delete device.serviceList
    const deviceList = device.deviceList
    delete device.deviceList

    if (isServiceList(serviceList.service)) {
      serviceList.service.forEach(service => {
        this.services.set(service.serviceType, new Service(service, this.url))
      })
    } else {
      this.services.set(
        serviceList.service.serviceType,
        new Service(serviceList.service, this.url)
      )
    }

    if (deviceList) {
      if (isDeviceList(deviceList.device)) {
        deviceList.device.forEach(dev => {
          this._getServices(dev)
          this.devices.set(dev.deviceType, dev)
        })
      } else {
        this._getServices(deviceList.device)
        this.devices.set(deviceList.device.deviceType, deviceList.device)
      }
    }
  }

  protected _parseDesc(url) {
    const uri = this.url.origin + url
    return requestXml({
      uri,
      rejectUnauthorized: false,
    }).then(result => {
      this.devices.set(result.root.device.deviceType, result.root.device)
      this._getServices(result.root.device)
    })
  }

  async exec(serviceId: string, actionName: string, pars?: any) {
    const service = this.services.get(serviceId)
    if (!service) {
      debug(`Available services`, this.services.keys())
      throw new Error(`service with id ${serviceId} not known`)
    }
    return service.execAction(actionName, pars)
  }

  async getHostInfos(...macAddresses: string[]): Promise<HostDescription[]> {
    const service = this.services.get('urn:dslforum-org:service:Hosts:1')
    await service.initialize()
    return Promise.all(
      macAddresses.map(host =>
        service.execAction('GetSpecificHostEntry', {
          NewMacAddress: host,
        })
      )
    ).then(result => {
      debug(result)
      return result.map((entry: any, idx: number) => ({
        mac: macAddresses[idx],
        ip: entry.NewIPAddress,
        active: entry.NewActive === '1',
        name: entry.NewHostName,
        interface: entry.NewInterfaceType,
      }))
    })
  }

  async getAllHosts(): Promise<HostDescription[]> {
    const service = this.services.get('urn:dslforum-org:service:Hosts:1')
    await service.initialize()
    return this.exec(
      'urn:dslforum-org:service:Hosts:1',
      'GetHostNumberOfEntries'
    ).then((result: any) => {
      const hosts = [
        ...Array(parseInt(result.NewHostNumberOfEntries, 0) - 1).keys(),
      ]

      return Promise.all(
        hosts.map(idx =>
          this.exec('urn:dslforum-org:service:Hosts:1', 'GetGenericHostEntry', {
            NewIndex: idx,
          })
        )
      ).then(out =>
        out.map((entry: any) => ({
          mac: entry.NewMACAddress,
          ip: entry.NewIPAddress,
          active: entry.NewActive === '1',
          name: entry.NewHostName,
          interface: entry.NewInterfaceType,
        }))
      )
    })
  }
}
