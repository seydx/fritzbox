'use strict';

const debug = require('debug')('fritzbox:device');
const { URL } = require('url');
const { from, lastValueFrom, range } = require('rxjs');
const { switchMap, map, mergeMap, tap, toArray } = require('rxjs/operators');

const { requestXml } = require('./request');
const Service = require('./service');
const { convertTemp } = require('./utils');

const TR064_DESC_URL = '/tr64desc.xml';
const IGD_DESC_URL = '/igddesc.xml';

const isServiceList = (service) => Array.isArray(service);
const isDeviceList = (device) => Array.isArray(device);

const DEFAULTS = {
  host: 'fritz.box',
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

    this.url = new URL(`http://${this.options.host}:${this.options.port}`);
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
     *
     * If device supports Wifi 2.4ghz, 2x Wifi 5ghz and Wifi guest etc
     * - WLANConfiguration1 = Wifi 2.4ghz
     * - WLANConfiguration2 = Wifi 5ghz
     * - WLANConfiguration3 = Wifi 5ghz
     * - WLANConfiguration4 = Wifi Guest
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

  async getAllHostsV2() {
    await this.initialize();

    const response = await this.exec('urn:LanDeviceHosts-com:serviceId:Hosts1', 'X_AVM-DE_GetHostListPath');
    const uri = `${this.url.protocol}//${this.url.hostname}:${this.url.port}${response['NewX_AVM-DE_HostListPath']}`;
    const hosts = await requestXml(uri, { https: { rejectUnauthorized: false } });

    return hosts.List.Item.map((entry) => ({
      mac: entry.MACAddress,
      ip: entry.IPAddress,
      active: entry.Active === '1',
      name: entry.HostName,
      interface: entry.InterfaceType,
    }));
  }

  async getSmarthomeDevices() {
    await this.initialize();

    const response = await this.exec('urn:DeviceConfig-com:serviceId:DeviceConfig1', 'X_AVM-DE_CreateUrlSID');
    const sid = response['NewX_AVM-DE_UrlSID'].split('sid=')[1];
    const uri = `http://${this.url.hostname}/webservices/homeautoswitch.lua?switchcmd=getdevicelistinfos&sid=${sid}}`;
    const devices = await requestXml(uri, { https: { rejectUnauthorized: false } });

    if (!Array.isArray(devices.devicelist.device)) {
      devices.devicelist.device = [devices.devicelist.device];
    }

    if (devices.devicelist.group && !Array.isArray(devices.devicelist.group)) {
      devices.devicelist.group = [devices.devicelist.group];
    }

    const deviceList = (devices.devicelist.device || []).filter((device) => device['$'].functionbitmask !== '1');
    const groupList = (devices.devicelist.group || []).filter((device) => device['$'].functionbitmask !== '1');

    const formattedDeviceList = deviceList.map((device) => {
      const formattedDevice = {
        name: device.name,
        id: device['$'].id,
        ain: device['$'].identifier.replace(/\s/g, ''),
        online: parseInt(device.present),
        bitmask: device['$'].functionbitmask,
        busy: parseInt(device.txbusy),
        battery: false,
        alert: false,
        temperature: false,
        humidity: false,
        powermeter: false,
        switch: false,
        button: false,
        blind: false,
        thermostat: false,
        light: false,
      };

      if (device.battery) {
        formattedDevice.battery = {
          value: parseInt(device.battery) || 0,
          low: parseInt(device.batterylow) || 0,
        };
      }

      if (device.alert) {
        formattedDevice.alert = {
          state: parseInt(device.alert.state) || 0,
        };
      }

      if (device.temperature) {
        formattedDevice.temperature = {
          value: parseInt(device.temperature.celsius) / 10 || 0,
          offset: parseInt(device.temperature.offset) || 0,
        };
      }

      if (device.humidity) {
        formattedDevice.humidity = {
          value: parseInt(device.humidity.rel_humidity) || 0,
        };
      }

      if (device.powermeter) {
        formattedDevice.powermeter = {
          voltage: parseInt(device.powermeter.voltage) / 1000 || 0, // >> voltage   = 0.001V = 1V
          power: parseInt(device.powermeter.power) / 1000 || 0, // >> power     = 0.001W = 1W
          energy: parseInt(device.powermeter.energy) / 1000 || 0, // >> energy    = 1.00Wh = 0.001 kWh
        };
      }

      if (device.switch) {
        formattedDevice.switch = {
          state: parseInt(device.switch.state) || 0,
        };
      }

      if (device.button) {
        if (Array.isArray(device.button)) {
          if (device.button.length > 2) {
            // more than 1 button, only with short support

            formattedDevice.button = {
              top_right: device.button[0],
              bottom_right: device.button[1],
              bottom_left: device.button[2],
              top_left: device.button[3],
            };

            /*formattedDevice.button = {
              top_left: device.button.find((button) => button['$'] && button['$'].id === '5003') || false,
              top_right: device.button.find((button) => button['$'] && button['$'].id === '5000') || false,
              bottom_left: device.button.find((button) => button['$'] && button['$'].id === '5002') || false,
              bottom_right: device.button.find((button) => button['$'] && button['$'].id === '5001') || false,
            };*/
          } else {
            // 1 button with short/long support

            formattedDevice.button = {
              short: device.button[0],
              long: device.button[1],
            };

            /*formattedDevice.button = {
              short: device.button.find((button) => button['$'] && button['$'].id === '5000') || false,
              long: device.button.find((button) => button['$'] && button['$'].id === '5001') || false,
            };*/
          }
        } else {
          // 1 button, only with short support

          formattedDevice.button = {
            short: {
              ...device.button,
            },
          };
        }
      }

      if (device.etsiunitinfo && parseInt(device.etsiunitinfo.unittype) === 281) {
        formattedDevice.blind = {
          position: false,
        };

        if (device.levelcontrol) {
          formattedDevice.blind.position = {
            level: parseInt(device.levelcontrol.level), // 0 - 255
            levelpercentage: parseInt(device.levelcontrol.levelpercentage), // 0 - 100
          };
        }
      }

      if (device.hkr) {
        formattedDevice.thermostat = {
          current: convertTemp(device.hkr.tist) || 0,
          target: convertTemp(device.hkr.tsoll) || 0,
          windowOpen: parseInt(device.hkr.windowopenactiv) || 0,
        };
      }

      if (device.simpleonoff && !device.switch) {
        // Fritz!Dect 500
        if (parseInt(device.etsiunitinfo.unittype) === 278) {
          formattedDevice.light = {
            state: parseInt(device.simpleonoff.state) || 0,
            brightness: false,
            color: false,
          };

          if (device.levelcontrol) {
            formattedDevice.light.brightness = {
              level: parseInt(device.levelcontrol.level), // 0 - 255
              levelpercentage: parseInt(device.levelcontrol.levelpercentage), // 0 - 100
            };
          }

          if (device.colorcontrol) {
            formattedDevice.light.color = {
              supported_modes: parseInt(device.colorcontrol['$'].supported_modes),
              current_mode: parseInt(device.colorcontrol['$'].current_mode),
              hue: parseInt(device.colorcontrol.hue), // 0 - 359
              saturation: parseInt(device.colorcontrol.saturation), // 0 - 100 (if current_mode === 1)
              temperature: parseInt(device.colorcontrol.temperature), // 2700 - 6500 Kelvin
            };
          }
          // Telekom HAN-FUN Outlet
        } else if (parseInt(device.etsiunitinfo.unittype) === 263) {
          formattedDevice.switch = {
            state: parseInt(device.simpleonoff.state) || 0,
          };
        }
      }

      return formattedDevice;
    });

    const formattedGroupList = groupList.map((device) => {
      const formattedGroup = {
        name: device.name,
        id: device['$'].id,
        ain: device['$'].identifier.replace(/\s/g, ''),
        online: parseInt(device.present),
        bitmask: device['$'].functionbitmask,
        busy: parseInt(device.txbusy),
        associated: false,
        battery: false,
        alert: false,
        temperature: false,
        humidity: false,
        powermeter: false,
        switch: false,
        button: false,
        blind: false,
        thermostat: false,
        light: false,
      };

      //TODO: Rewrite in a later version
      if (device.groupinfo && device.groupinfo.members) {
        if (device.groupinfo.members.includes(',')) {
          formattedGroup.associated = device.groupinfo.members.split(',');
        } else {
          formattedGroup.associated = [device.groupinfo.members];
        }

        const types = [];

        formattedGroup.associated = formattedGroup.associated
          .map((id) => {
            const foundDevice = formattedDeviceList.filter((device) => {
              if (device.id === id) {
                if (device.light && !types.includes('light')) {
                  types.push('light');
                }

                if (device.switch && !types.includes('switch')) {
                  types.push('switch');
                }

                if (device.thermostat && !types.includes('thermostat')) {
                  types.push('thermostat');
                }
                return device;
              }
            });

            if (foundDevice) {
              return foundDevice[0];
            }
          })
          .filter((device) => device);

        if (types.length) {
          if (types.includes('thermostat')) {
            let batteryValues = formattedGroup.associated
              .map((device) => {
                if (device.battery) {
                  return device.battery.value;
                }
              })
              .filter((device) => !isNaN(device));

            let batteryLows = formattedGroup.associated
              .map((device) => {
                if (device.battery) {
                  return device.battery.low;
                }
              })
              .filter((device) => !isNaN(device));

            formattedGroup.battery = {
              value: batteryValues.reduce((p, c) => p + c, 0) / batteryValues.length,
              low: batteryLows.includes(0) ? 0 : 1,
            };
          }

          if (types.includes('switch') || types.includes('thermostat')) {
            let temps = formattedGroup.associated
              .map((device) => {
                if (device.temperature) {
                  return device.temperature.value;
                }
              })
              .filter((device) => !isNaN(device));

            let offs = formattedGroup.associated
              .map((device) => {
                if (device.temperature) {
                  return device.temperature.offset;
                }
              })
              .filter((device) => !isNaN(device));

            let humids = formattedGroup.associated
              .map((device) => {
                if (device.humidity) {
                  return device.humidity.value;
                }
              })
              .filter((device) => !isNaN(device));

            if (temps.length && offs.length) {
              formattedGroup.temperature = {
                value: temps.reduce((p, c) => p + c, 0) / temps.length,
                offset: offs.reduce((p, c) => p + c, 0) / offs.length,
              };
            }

            if (humids.length) {
              formattedGroup.humidity = {
                value: humids.reduce((p, c) => p + c, 0) / humids.length,
              };
            }
          }

          //brightness

          let levels = formattedGroup.associated
            .map((device) => {
              if (device.light && device.light.brightness) {
                return device.light.brightness.level;
              }
            })
            .filter((device) => !isNaN(device));

          let levelpercentages = formattedGroup.associated
            .map((device) => {
              if (device.light && device.light.brightness) {
                return device.light.brightness.levelpercentage;
              }
            })
            .filter((device) => !isNaN(device));

          if (levels.length && levelpercentages.length) {
            if (!formattedGroup.light) {
              formattedGroup.light = {};
            }

            formattedGroup.light.brightness = {
              level: levels.reduce((p, c) => p + c, 0) / levels.length,
              levelpercentage: levelpercentages.reduce((p, c) => p + c, 0) / levelpercentages.length,
            };
          }

          //color

          let hues = formattedGroup.associated
            .map((device) => {
              if (device.light && device.light.color) {
                return device.light.color.hue;
              }
            })
            .filter((device) => !isNaN(device));

          let sats = formattedGroup.associated
            .map((device) => {
              if (device.light && device.light.color) {
                return device.light.color.saturation;
              }
            })
            .filter((device) => !isNaN(device));

          let cTemps = formattedGroup.associated
            .map((device) => {
              if (device.light && device.light.color) {
                return device.light.color.temperature;
              }
            })
            .filter((device) => !isNaN(device));

          if (hues.length && sats.length) {
            if (!formattedGroup.light) {
              formattedGroup.light = {};
            }

            formattedGroup.light.color = {
              hue: hues.reduce((p, c) => p + c, 0) / hues.length,
              saturation: sats.reduce((p, c) => p + c, 0) / sats.length,
              temperature: null,
            };
          } else if (cTemps.length) {
            formattedGroup.light.color = {
              hue: null,
              saturation: null,
              temperature: cTemps.reduce((p, c) => p + c, 0) / cTemps.length,
            };
          }
        }
      }

      if (device.battery) {
        formattedGroup.battery = {
          value: parseInt(device.battery) || 0,
          low: parseInt(device.batterylow) || 0,
        };
      }

      if (device.alert) {
        formattedGroup.alert = {
          state: parseInt(device.alert.state) || 0,
        };
      }

      if (device.temperature) {
        formattedGroup.temperature = {
          value: parseInt(device.temperature.celsius) / 10 || 0,
          offset: parseInt(device.temperature.offset) || 0,
        };
      }

      if (device.humidity) {
        formattedGroup.humidity = {
          value: parseInt(device.humidity.rel_humidity) || 0,
        };
      }

      if (device.powermeter) {
        formattedGroup.powermeter = {
          voltage: parseInt(device.powermeter.voltage) / 1000 || 0, // >> voltage   = 0.001V = 1V
          power: parseInt(device.powermeter.power) / 1000 || 0, // >> power     = 0.001W = 1W
          energy: parseInt(device.powermeter.energy) / 1000 || 0, // >> energy    = 1.00Wh = 0.001 kWh
        };
      }

      if (device.switch) {
        formattedGroup.switch = {
          state: parseInt(device.switch.state) || 0,
        };
      }

      if (device.button) {
        if (Array.isArray(device.button)) {
          if (device.button.length > 2) {
            // more than 1 button, only with short support

            formattedGroup.button = {
              top_right: device.button[0],
              bottom_right: device.button[1],
              bottom_left: device.button[2],
              top_left: device.button[3],
            };

            /*formattedDevice.button = {
              top_left: device.button.find((button) => button['$'] && button['$'].id === '5003') || false,
              top_right: device.button.find((button) => button['$'] && button['$'].id === '5000') || false,
              bottom_left: device.button.find((button) => button['$'] && button['$'].id === '5002') || false,
              bottom_right: device.button.find((button) => button['$'] && button['$'].id === '5001') || false,
            };*/
          } else {
            // 1 button with short/long support

            formattedGroup.button = {
              short: device.button[0],
              long: device.button[1],
            };

            /*formattedDevice.button = {
              short: device.button.find((button) => button['$'] && button['$'].id === '5000') || false,
              long: device.button.find((button) => button['$'] && button['$'].id === '5001') || false,
            };*/
          }
        } else {
          // 1 button, only with short support

          formattedGroup.button = {
            short: {
              ...device.button,
            },
          };
        }
      }

      if (device.etsiunitinfo && parseInt(device.etsiunitinfo.unittype) === 281) {
        formattedGroup.blind = {
          position: false,
        };

        if (device.levelcontrol) {
          formattedGroup.blind.position = {
            level: parseInt(device.levelcontrol.level), // 0 - 255
            levelpercentage: parseInt(device.levelcontrol.levelpercentage), // 0 - 100
          };
        }
      }

      if (device.hkr) {
        formattedGroup.thermostat = {
          current: convertTemp(device.hkr.tist) || 0,
          target: convertTemp(device.hkr.tsoll) || 0,
          windowOpen: parseInt(device.hkr.windowopenactiv) || 0,
        };

        if (formattedGroup.associated) {
          //If multiple HKR devices are in a group, we need to find the average current temperature

          const associatedDevices = formattedDeviceList.filter((hkrDevice) =>
            formattedGroup.associated.find((associatedDevice) => associatedDevice.id === hkrDevice.id)
          );

          const currentTemps = associatedDevices.map((associatedDevice) => {
            return parseInt(associatedDevice.thermostat.current);
          });

          const sum = currentTemps.reduce((a, b) => a + b, 0);
          const avg = sum / currentTemps.length || 0;

          formattedGroup.thermostat.current = avg;
        }
      }

      if (device.simpleonoff && !device.switch) {
        // Fritz!Dect 500
        if (parseInt(device.etsiunitinfo.unittype) === 278) {
          formattedGroup.light = {
            state: parseInt(device.simpleonoff.state) || 0,
            brightness: false,
            color: false,
          };

          if (device.levelcontrol) {
            formattedGroup.light.brightness = {
              level: parseInt(device.levelcontrol.level), // 0 - 255
              levelpercentage: parseInt(device.levelcontrol.levelpercentage), // 0 - 100
            };
          }

          if (device.colorcontrol) {
            formattedGroup.light.color = {
              supported_modes: parseInt(device.colorcontrol['$'].supported_modes),
              current_mode: parseInt(device.colorcontrol['$'].current_mode),
              hue: parseInt(device.colorcontrol.hue), // 0 - 359
              saturation: parseInt(device.colorcontrol.saturation), // 0 - 100 (if current_mode === 1)
              temperature: parseInt(device.colorcontrol.temperature), // 2700 - 6500 Kelvin
            };
          }
          // Telekom HAN-FUN Outlet
        } else if (parseInt(device.etsiunitinfo.unittype) === 263) {
          formattedGroup.switch = {
            state: parseInt(device.simpleonoff.state) || 0,
          };
        }
      }

      return formattedGroup;
    });

    return {
      devices: formattedDeviceList,
      groups: formattedGroupList,
    };
  }
}

module.exports = Fritzbox;
