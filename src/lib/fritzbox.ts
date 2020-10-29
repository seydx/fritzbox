import Debug from 'debug'
import { defaults } from 'underscore'
import { URL } from 'url'
import {
  Device,
  FritzboxOptions,
  HostDescription,
  FritzboxDescription,
  ServiceDescription,
  FritzEvent,
} from './model'
import { requestXml } from './request'
import { Service } from './service'
import { Observable, using, Unsubscribable, from, range } from 'rxjs'
import { EventServer } from './eventserver'
import {
  switchMap,
  map,
  share,
  mergeMap,
  tap,
  take,
  toArray,
} from 'rxjs/operators'

const debug = Debug('ulfalfa:fritzbox:device')

const TR064_DESC_URL = '/tr64desc.xml'
const IGD_DESC_URL = '/igddesc.xml'

const isServiceList = (
  service: ServiceDescription[] | ServiceDescription
): service is ServiceDescription[] => {
  return Array.isArray(service)
}

const isDeviceList = (device: Device[] | Device): device is Device[] => {
  return Array.isArray(device)
}

const DEFAULTS: FritzboxOptions = {
  url: 'http://fritz.box:49000',

  username: undefined,
  password: undefined,
  eventAddress: undefined,
  eventPort: undefined,
  
  tr064: true,
  igd: true,

  autoSsl: true,
}
/**
 * This classes wraps all functionality for accessing a fritzbox via [TR-064](https://avm.de/service/schnittstellen/)
 *
 * @export
 */
export class Fritzbox implements Unsubscribable {
  protected services: Map<string, Service> = new Map()
  protected devices: Map<string, Device> = new Map()

  protected readonly options: FritzboxOptions

  protected initialized = false

  protected observable: Observable<any>
  protected es: EventServer

  /**
   * the current url to access the fritzbox
   *
   */
  readonly url: URL
  eventServiceTypes: string[]

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
  /**
   * initializes the fritzbox by loading the available services
   * from /tr64desc.xml and /igddesc.xml
   * can be ommitted, because it's automatically called by any of the services
   *
   * @date 2019-12-17
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }
    if (this.options.tr064) {
      await this.parseDesc(TR064_DESC_URL)
    }
    if (this.options.igd) {
      await this.parseDesc(IGD_DESC_URL)
    }
    this.initialized = true
    if (this.options.autoSsl) {
      await this.upgradeSsl()
    }
  }
  /**
   * extracts the services from a device and register it
   *
   * @date 2019-12-17
   * @param device the device to parse
   */
  protected getServices(device: Device) {
    const serviceList = device.serviceList
    delete device.serviceList
    const deviceList = device.deviceList
    delete device.deviceList

    if (isServiceList(serviceList.service)) {
      serviceList.service.forEach(service => {
        this.services.set(service.serviceId, new Service(service, this.url))
      })
    } else {
      this.services.set(
        serviceList.service.serviceId,
        new Service(serviceList.service, this.url)
      )
    }

    if (deviceList) {
      if (isDeviceList(deviceList.device)) {
        deviceList.device.forEach(dev => {
          this.getServices(dev)
          this.devices.set(dev.deviceType, dev)
        })
      } else {
        this.getServices(deviceList.device)
        this.devices.set(deviceList.device.deviceType, deviceList.device)
      }
    }
  }

  /**
   * retrieves the description of a single url from the fritzbox
   * and extract the available services
   *
   * @date 2019-12-17
   * @param url the url to fetch (e.g. /tr64desc.xml)
   * @returns the json structure of the xml loaded from fritzbox
   */
  protected parseDesc(url: string): Promise<any> {
    const uri = this.url.origin + url
    return requestXml({
      uri,
      rejectUnauthorized: false,
    }).then(result => {
      this.devices.set(result.root.device.deviceType, result.root.device)
      this.getServices(result.root.device)
    })
  }

  /**
   * executes an action of a service and returns the result
   *
   * @example
   * e.g. you can get information about the fritzbox with following code
   * ```
   * const fb = new Fritzbox({ username: 'test', password: 'testPwd123' })
   * await fb.initialize()
   * console.log (await fb..exec('urn:dslforum-org:service:DeviceInfo:1', 'GetInfo'))
   * ```
   *
   * @param [pars] parameters to pass as json object
   * @returns an object with return values
   */
  async exec(
    serviceId: string,
    actionName: string,
    pars?: object
  ): Promise<object> {
    await this.initialize()
    let service = this.services.get(serviceId)
    if (!service) {
    
      let newService;
      let check = 'dslforum-org';
      
      for(const [srvc, child] of this.services){
         if(serviceId.includes(check)){ //urn:dslforum-org:service:WLANConfiguration:1
           let name = serviceId.split(':')[3];
           let nr = serviceId.split(':')[4];
           if(nr){
             name = name + nr;
           }
           if(srvc.includes(name)){
             newService = srvc;
           } else {
             if(name.includes('WLAN') && nr){     
                let nameNr = parseInt(nr) - 1;
                name = name.substring(0, name.length - 1) + nameNr;                
                if(srvc.includes(name)){
                  newService = srvc;
                }    
             }
           }
           
         } else { //urn:WLANConfiguration-com:serviceId:WLANConfiguration1
           let name = serviceId.split(':')[3];
           let lastChar = parseInt(name.substring(name.length - 1));
           if(!isNaN(lastChar)){
             name = name.substring(0, name.length - 1);
           }
           if(srvc.includes(name)){
             newService = srvc;
           } else {
             if(name.includes('WLAN') && !isNaN(lastChar)){     
                let nr = lastChar - 1;
                name = name.substring(0, name.length - 1) + nr;                
                if(srvc.includes(name)){
                  newService = srvc;
                }    
             }
           }
         }
      }
      
      if(newService){
        service = this.services.get(newService)
      } else {
        debug(`Available services`, this.services.keys())
        throw new Error(`service with id ${serviceId} not known`);
      }

    }
    return service.execAction(actionName, pars)
  }

  /**
   * convenient function for getting all hostinfos from fritzbox by their correspondig
   * mac addresses
   *
   * @param macAddresses a list of macaddresses
   * @returns info of the requested hosts
   */
  async getHostInfos(...macAddresses: string[]): Promise<HostDescription[]> {
    const service = this.services.get('urn:LanDeviceHosts-com:serviceId:Hosts1')
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
  /**
   * convenient function for getting information about all hosts currently registered
   * at the fritz box
   *
   * @returns info of the requested hosts
   */
  async getAllHosts(): Promise<any[]> {
    await this.initialize()
    return from(
      this.exec(
        'urn:LanDeviceHosts-com:serviceId:Hosts1',
        'GetHostNumberOfEntries'
      )
    )
      .pipe(
        switchMap((result: { NewHostNumberOfEntries: string }) =>
          range(1, parseInt(result.NewHostNumberOfEntries, 0) - 1)
        ),
        tap(result => debug('Result', result)),
        mergeMap(
          idx =>
            this.exec(
              'urn:LanDeviceHosts-com:serviceId:Hosts1',
              'GetGenericHostEntry',
              {
                NewIndex: idx,
              }
            ),
          20
        ),
        map((entry: any) => ({
          mac: entry.NewMACAddress,
          ip: entry.NewIPAddress,
          active: entry.NewActive === '1',
          name: entry.NewHostName,
          interface: entry.NewInterfaceType,
        })),

        toArray()
      )
      .toPromise()
  }
  /**
   * gets a short description of all services available
   * in the fritzbox
   * for a detailed description of a service see [[Service.describe]]
   */
  async describe(): Promise<FritzboxDescription[]> {
    await this.initialize()
    const services = Array.from(this.services.values())
    const result = await Promise.all(
      services.map(service =>
        service.describe().then(desc => ({
          id: desc.serviceId,
          sendEvents: desc.events.length > 0,
          actions: desc.actions.map(action => action.name),
        }))
      )
    )
    this.eventServiceTypes = result
      .filter(service => service.sendEvents)
      .map(service => service.id)
    return result
  }

  protected getServiceTypeBySid(sid: string): string {
    let result: string
    this.services.forEach(service => {
      if (service.sid === sid) {
        result = service.serviceId
        return
      }
    })
    return result
  }
  /**
   * observes *all* events send from the fritzbox and returning a shareable observable
   */
  observe(): Observable<FritzEvent> {
    if (!this.observable) {
      debug('Creating observable')
      const observable = using(
        () => {
          debug('Creating eventserver')
          this.es =
            this.es ||
            new EventServer(this.options.eventPort, this.options.eventAddress)
          this.es.listen()
          this.eventServiceTypes.forEach(type => {
            debug('Subscribing', type)
            const service = this.services.get(type)
            service.subscribe(this.es.callback)
          })
          return this
        },
        fb => {
          debug('Subscribe to services')
          return this.es.asObservable().pipe(
            tap(data => debug('Data received', data)),
            map(event => {
              event.service = this.getServiceTypeBySid(event.sid)
              return event
            })
          )
        }
      )
      this.observable = from(this.describe())
        .pipe(mergeMap(() => observable))
        .pipe(share())
    }
    return this.observable
  }

  unsubscribe() {
    debug('Destroying observable')
    this.es.close()
  }
  /**
   * get the ssl port of tr064 in fritzbox
   *
   */
  async getSecurityPort(): Promise<string> {
    return this.exec(
      'urn:DeviceInfo-com:serviceId:DeviceInfo1',
      'GetSecurityPort'
    ).then((result: any) => {
      debug('Anwer', result)
      return result.NewSecurityPort
    })
  }

  protected async upgradeSsl() {
    debug(`current protocol is ${this.url.protocol}`)

    const port = await this.getSecurityPort()
    this.url.protocol = 'https:'
    this.url.port = port
  }
  /**
   * gets the current external ipv4 address of the fritzbox
   *
   */
  async getExternalIPV4(): Promise<string> {
    return this.exec(
      'urn:schemas-upnp-org:service:WANIPConnection:1',
      'GetExternalIPAddress'
    ).then((result: any) => result.NewExternalIPAddress as string)
  }
}
