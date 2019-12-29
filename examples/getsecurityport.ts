import { Fritzbox } from '../src/lib/fritzbox'

const box = new Fritzbox({ username: 'test', password: 'testPwd123' })

box
  .exec('urn:DeviceInfo-com:serviceId:DeviceInfo1', 'GetSecurityPort')
  .then(console.log)
  .then(() => box.getSecurityPort())
  .then(port => console.log(`Or direct: The ssl port is ${port}`))
  .catch(err => {
    console.log(err)
  })
