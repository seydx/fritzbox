export interface FritzboxOptions {
  host: string
  port: number
  ssl: boolean
  serverPort: number
  serverAddress: string
  user: string
  pass: string
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
export function isServiceList(
  service: ServiceDescription[] | ServiceDescription
): service is ServiceDescription[] {
  return Array.isArray(service)
}

export function isDeviceList(device: Device[] | Device): device is Device[] {
  return Array.isArray(device)
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
