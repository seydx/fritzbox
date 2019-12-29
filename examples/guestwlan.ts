import { Fritzbox } from '../src/lib/fritzbox'

import { filter } from 'rxjs/operators'

const box = new Fritzbox({
  username: 'test',
  password: 'testPwd123',
  eventAddress: '192.168.1.159',
  eventPort: 9999,
})

/*box
  .observe()
  .pipe(
    filter(
      type =>
        type.service ===
        'urn:WLANConfiguration-com:serviceId:WLANConfiguration3'
    )
  )
  .subscribe(console.log)
*/

box
  .exec('urn:WLANConfiguration-com:serviceId:WLANConfiguration3', 'SetEnable', {
    NewEnable: false,
  })
  .then(console.log, console.error)
  .then(() =>
    box.exec(
      'urn:WLANConfiguration-com:serviceId:WLANConfiguration3',
      'GetSSID'
    )
  )
  .then(console.log, console.error)
