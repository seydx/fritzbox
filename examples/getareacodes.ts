import { Fritzbox } from '../src/lib/fritzbox'

const box = new Fritzbox({ username: 'test', password: 'testPwd123' })

box
  .exec('urn:dslforum-org:service:X_VoIP:1', 'X_AVM-DE_GetVoIPCommonAreaCode')
  .then(console.log)
  .then(() =>
    box.exec(
      'urn:dslforum-org:service:X_VoIP:1',
      'X_AVM-DE_GetVoIPCommonCountryCode'
    )
  )
  .then(console.log)
  .catch(err => {
    console.log(err)
  })
