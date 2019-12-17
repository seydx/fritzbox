import { Fritzbox } from './lib/fritzbox'

const box = new Fritzbox({ username: 'test', password: 'testPwd123' })

// Initialize Device

box
  .initialize()
  // Print information about available services
  .then(result => {
    /*result.forEach(sid => {
      console.log('Subscribed: ' + sid)
    })*/
    return box.exec(
      'urn:dslforum-org:service:Hosts:1',
      'GetHostNumberOfEntries'
    )
  })
  .then(result => console.log(result))
  .catch(err => {
    console.log(err)
  })
