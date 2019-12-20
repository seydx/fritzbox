import { Fritzbox } from '../src/lib/fritzbox'

const box = new Fritzbox({ username: 'test', password: 'testPwd123' })

box
  .exec('urn:dslforum-org:service:DeviceInfo:1', 'GetSecurityPort')
  .then(console.log)
  .then(() => box.getSecurityPort())
  .then(port => console.log(`Or direct is ist ${port}`))
  .catch(err => {
    console.log(err)
  })
