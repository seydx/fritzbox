import { Fritzbox } from './lib/device'

const options = {
  host: 'fritz.box',
  port: 49443,
  ssl: true,
  user: 'test',
  pass: 'testPwd123',
  serverPort: 52400,
  serverAddress: '192.168.1.159',
}

const box = new Fritzbox(options)

// Initialize Device
Promise.all([box.initTR064Device(), box.initIGDDevice()])
  // Print information about available services
  .then(() => {
    /*for (const serviceName in box.services) {
      console.log('=== ' + serviceName + ' ===')
      for (const actionName in box.services[serviceName].actionsInfo) {
        console.log('   # ' + actionName + '()')
        box.services[serviceName].actionsInfo[actionName].inArgs.forEach(
          arg => {
            console.log('     IN : ' + arg)
          }
        )
        box.services[serviceName].actionsInfo[actionName].outArgs.forEach(
          arg => {
            console.log('     OUT : ' + arg)
          }
        )
      }
    }*/
    console.log(box.listServices())
  })
  .then(() => {
    return Promise.all([
      box
        .service('urn:dslforum-org:service:LANHostConfigManagement:1')
        .subscribe(),
      box.service('urn:dslforum-org:service:WLANConfiguration:1').subscribe(),
      box.service('urn:dslforum-org:service:WLANConfiguration:2').subscribe(),
      box.service('urn:dslforum-org:service:Hosts:1').subscribe(),
      box.service('urn:schemas-upnp-org:service:WANIPConnection:1').subscribe(),
    ])
  })
  .then(result => {
    result.forEach(sid => {
      console.log('Subscribed: ' + sid)
    })
    return box
      .service('urn:dslforum-org:service:Hosts:1')
      .actions.GetHostNumberOfEntries()
  })
  .then(result => {})
  .catch(err => {
    console.log(err)
  })
