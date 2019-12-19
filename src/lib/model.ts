export interface FritzboxOptions {
  url: string
  username: string
  password: string
  eventAddress: string
  eventPort: 9999
}

export interface DeviceDescription {
  deviceType: string
  friendlyName: string
  manufacturer: string
  manufacturerURL: string
  modelDescription: string
  modelName: string
  modelNumber: string
  modelURL: string
  UDN: string
}

export interface Device extends DeviceDescription {
  iconList: {
    icon: {
      mimetype: string
      width: string
      height: string
      depth: string
      url: string
    }
  }
  serviceList: { service: ServiceDescription[] | ServiceDescription }
  deviceList: { device: Device[] | Device }
  presentationURL: string
}

export interface ServiceDescription {
  serviceType: string
  serviceId: string
  controlURL: string
  eventSubURL: string
  SCPDURL: string
}
export interface ServiceDescriptionExt extends ServiceDescription {
  actions: Action[]
  events: string[]
}
export interface Action {
  name: string
  parameter: any
  return: any
}

export interface HostDescription {
  mac: string
  ip: string
  active: boolean
  name: string
  interface: string
}

export interface FritzboxDescription {
  type: string
  sendEvents: boolean
  actions: string[]
}

export interface FritzEvent {
  data: any
  event: string
  service: string
  sid: string
}
