import { Fritzbox } from '../src/lib/fritzbox'

import { filter } from 'rxjs/operators'

const box = new Fritzbox({
  username: 'test',
  password: 'testPwd123',
})

box
  .exec(
    'urn:schemas-upnp-org:service:WANIPConnection:1',
    'GetExternalIPAddress'
  )
  .then(console.log, console.error)
  .then(() =>
    box
      .exec(
        'urn:schemas-upnp-org:service:WANIPConnection:1',
        'X_AVM_DE_GetExternalIPv6Address'
      )
      .then(console.log, console.error)
  )
