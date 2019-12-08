import { parseStringPromise as parseString } from 'xml2js'
import { request } from './request'
import { Server, createServer } from 'http'
import { defaults } from 'underscore'
import { Service } from './Service'
import {
  Device,
  FritzboxOptions,
  DeviceDescription,
  ServiceDescription,
  isServiceList,
  isDeviceList,
} from './model'
import Debug from 'debug'
import { inspect } from 'util'
const debug = Debug('ulfalfa:fritz:device')

const TR064_DESC_URL = '/tr64desc.xml'
const IGD_DESC_URL = '/igddesc.xml'

const DEFAULTS: FritzboxOptions = {
  host: 'fritz.box',
  port: 49443,
  ssl: false,
  serverPort: undefined,
  serverAddress: undefined,
  user: undefined,
  pass: undefined,
}

export class Fritzbox {
  server: Server

  services: Map<string, Service>
  devices: Map<string, Device>

  protocol = 'http://'

  options: FritzboxOptions

  constructor(options?: Partial<FritzboxOptions>) {
    this.options = defaults({}, options, DEFAULTS)
    debug('Options set', this.options)
    this.protocol = this.options.ssl ? 'https://' : 'http://'

    if (this.options.serverPort) {
      this._startSubscriptionResponseServer()
    }

    this.services = new Map()
    this.devices = new Map()
  }

  initialize() {
    return this.initTR064Device()
  }
  initTR064Device() {
    return this._parseDesc(TR064_DESC_URL)
  }
  initIGDDevice() {
    return this._parseDesc(IGD_DESC_URL)
  }

  _getServices(device: Device) {
    const serviceList = device.serviceList
    delete device.serviceList
    const deviceList = device.deviceList
    delete device.deviceList

    if (serviceList) {
      if (isServiceList(serviceList.service)) {
        serviceList.service.forEach(service => {
          this.services.set(
            service.serviceType,
            new Service(service, device, this.options)
          )
        })
      } else {
        this.services.set(
          serviceList.service.serviceType,
          new Service(serviceList.service, device, this.options)
        )
      }
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
  _handleRequest(req, res) {
    // console.log('SUBSCRIPTION', req);
    let body: any = []
    req
      .on('data', chunk => {
        body.push(chunk)
      })
      .on('end', () => {
        body = Buffer.concat(body).toString()
        // at this point, `body` has the entire request body stored in it as a string
        console.log('BODY', body)
        console.log(req.headers)
      })
    res.end()
  }
  _startSubscriptionResponseServer() {
    this.server = createServer()
    this.server.listen(this.options.serverPort, () => {
      this.server.on('request', this._handleRequest)
    })
  }
  listServices() {
    return Array.from(this.services.values()).map(service => service.meta)
  }

  service(type: string): Service {
    const service = this.services.get(type)
    return service
  }

  protected _parseDesc(url) {
    const uri =
      this.protocol + this.options.host + ':' + this.options.port + url
    return request({
      uri,
      rejectUnauthorized: false,
    })
      .then(response => {
        if (response.statusCode === 200) {
          return parseString(response.body, {
            explicitArray: false,
          })
        } else {
          throw new Error(
            `Invalid response: ${response.statusCode}:${response.statusMessage}`
          )
        }
      })
      .then(result => {
        this.devices.set(result.root.device.deviceType, result.root.device)
        this._getServices(result.root.device)
      })
      .then(() => {
        return Promise.all(
          Array.from(this.services.values()).map(service =>
            service.initialize()
          )
        )
      })
  }
}
