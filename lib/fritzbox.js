const debug = require('debug')('fritzbox:device');
const { URL } = require('url');
const { from, lastValueFrom, range } = require('rxjs');
const { switchMap, map, mergeMap, tap, toArray } = require('rxjs/operators');

const { requestXml } = require('./request');
const Service = require('./service');

const TR064_DESC_URL = '/tr64desc.xml';
const IGD_DESC_URL = '/igddesc.xml';

const isServiceList = (service) => Array.isArray(service);
const isDeviceList = (device) => Array.isArray(device);

const DEFAULTS = {
  url: 'http://fritz.box',
  port: 49000,
  username: undefined,
  password: undefined,
  tr064: true,
  igd: false,
  ssl: true,
};

class Fritzbox {
  constructor(options) {
    this.services = new Map();
    this.devices = new Map();

    this.options = {
      ...DEFAULTS,
      ...options,
    };

    debug('Options set', this.options);

    this.url = new URL(`${this.options.url}:${this.options.port}`);
    this.url.password = this.options.password;
    this.url.username = this.options.username;

    debug('Using url', this.url.toString());

    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      return;
    }
    if (this.options.tr064) {
      await this.parseDesc(TR064_DESC_URL);
    }
    if (this.options.igd) {
      await this.parseDesc(IGD_DESC_URL);
    }

    this.initialized = true;

    if (this.options.ssl) {
      await this.upgradeSsl();
    }
  }

  getServices(device) {
    const serviceList = device.serviceList;
    delete device.serviceList;

    const deviceList = device.deviceList;
    delete device.deviceList;

    if (!isServiceList(serviceList.service)) {
      serviceList.service = [serviceList.service];
    }

    serviceList.service.forEach((service) =>
      this.services.set(service.serviceId, new Service(service, this.url, this.options))
    );

    if (deviceList) {
      if (!isDeviceList(deviceList.device)) {
        deviceList.device = [deviceList.device];
      }

      deviceList.device.forEach((dev) => {
        this.getServices(dev);
        this.devices.set(dev.deviceType, dev);
      });
    }
  }

  async parseDesc(url) {
    const uri = this.url.origin + url;
    const result = await requestXml(uri, {
      https: {
        rejectUnauthorized: false,
      },
    });

    this.devices.set(result.root.device.deviceType, result.root.device);
    this.getServices(result.root.device);

    return;
  }

  async exec(serviceId, actionName, pars) {
    await this.initialize();

    let service = this.services.get(serviceId);

    /*
     * If device only supports Wifi 2.4ghz and Wifi guest
     * - WLANConfiguration1 = Wifi 2.4ghz
     * - WLANConfiguration2 = Wifi Guest
     *
     * If device supports Wifi 2.4ghz, Wifi 5ghz and Wifi guest
     * - WLANConfiguration1 = Wifi 2.4ghz
     * - WLANConfiguration2 = Wifi 5ghz
     * - WLANConfiguration3 = Wifi Guest
     */

    if (!service && serviceId.split('serviceId:')[1] === 'WLANConfiguration3') {
      serviceId = 'urn:WLANConfiguration-com:serviceId:WLANConfiguration2';
      service = this.services.get(serviceId);
    }

    if (!service) {
      debug('Available services', this.services.keys());
      throw new Error(`service with id ${serviceId} not known`);
    }
    return service.execAction(actionName, pars);
  }

  async describe() {
    await this.initialize();

    const services = Array.from(this.services.values());
    const result = await Promise.all(
      services.map(async (service) => {
        const desc = await service.describe();
        return {
          id: desc.serviceId,
          actions: desc.actions.map((action) => action.name),
        };
      })
    );

    return result;
  }

  async getSecurityPort() {
    const result = await this.exec('urn:DeviceInfo-com:serviceId:DeviceInfo1', 'GetSecurityPort');
    debug('Response', result);

    return result.NewSecurityPort;
  }

  async upgradeSsl() {
    debug(`Current protocol is ${this.url.protocol}`);

    const port = await this.getSecurityPort();
    this.url.protocol = 'https:';
    this.url.port = port;

    return;
  }

  async getAllHosts() {
    await this.initialize();

    const source = from(this.exec('urn:LanDeviceHosts-com:serviceId:Hosts1', 'GetHostNumberOfEntries')).pipe(
      switchMap((result) => range(1, parseInt(result.NewHostNumberOfEntries, 0) - 1)),
      tap((result) => debug('Result', result)),
      mergeMap(
        (idx) =>
          this.exec('urn:LanDeviceHosts-com:serviceId:Hosts1', 'GetGenericHostEntry', {
            NewIndex: idx,
          }),
        20
      ),
      map((entry) => ({
        mac: entry.NewMACAddress,
        ip: entry.NewIPAddress,
        active: entry.NewActive === '1',
        name: entry.NewHostName,
        interface: entry.NewInterfaceType,
      })),

      toArray()
    );

    return await lastValueFrom(source);
  }
}

module.exports = Fritzbox;
