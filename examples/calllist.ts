import { Fritzbox } from '../src/lib/fritzbox'
import { requestXml } from '../src/lib/request'
import { inspect } from 'util'

const box = new Fritzbox({ username: 'test', password: 'testPwd123' })

box
  .exec('urn:X_AVM-DE_OnTel-com:serviceId:X_AVM-DE_OnTel1', 'GetCallList')
  .then((result: any) => {
    const uri = result.NewCallListURL
    console.log(uri)
    return requestXml({ uri, qs: { days: 1 }, rejectUnauthorized: false })
  })
  .then(book => console.log(inspect(book, { depth: null })))
  .catch(err => {
    console.log(err)
  })
