# Changelog

# v2.2.4 - 2021-06-21
- Minor bugfixes

# v2.2.3 - 2021-06-20
- Better error debug

# v2.2.2 - 2021-06-20
- Better error debug

# v2.2.1 - 2021-06-20
- Bugfix
  
# v2.2.0 - 2021-06-20
- Bugfix

# v2.1.9 - 2021-06-18
- Support for buttons (2/4 channel)

# v2.1.8 - 2021-06-15
- Changed `requestAHA(host, ain, sid, cmd)` to `requestAHA(host, cmd)`
  
# v2.1.7 - 2021-06-15
- Revert back changes from v2.1.6

# v2.1.6 - 2021-06-15
- Fix smarthome device/group ain

# v2.1.5 - 2021-06-15
- Fix blind position data
  
# v2.1.4 - 2021-06-15
- Fix `searchParams` for `reqeustAHA`
  
# v2.1.3 - 2021-06-14
- Return `object` for `requestLUA`

# v2.1.2 - 2021-06-14
- Added `blind` (smarthome) support
  
# v2.1.1 - 2021-06-14
- Added more debug
- 
# v2.1.0 - 2021-06-14
- Added new methods: `fritzbox.getAllHostsV2()`, `fritzbox.getSmarthomeDevices()`
- Added new request types: `requestAHA(..)`, `requestLUA(..)`

# v2.0.5 - 2021-05-29
- Fix special characters in URL

# v2.0.4 - 2021-05-29
- Fix special characters in URL
  
# v2.0.3 - 2021-05-21
- Better error handling

# v2.0.2 - 2021-05-21
- Switched to `serviceId`
- Better error handling
- Minor improvements and bugfixes

# v2.0.1 - 2021-05-21
- Better error handling

# v2.0.0 - 2021-05-20

## Breaking Changes
- **1)** Due to refractorization the module must be imported differently

```js
//BEFORE
const { Fritzbox } = require('@seydx/fritzbox');
//import { Fritzbox } from ('@seydx/fritzbox');

//AFTER
const Fritzbox = require('@seydx/fritzbox');
//import Fritzbox from ('@seydx/fritzbox');

```

- **2)** The new version uses `got` instead of `request`. Therefore requests using [requestXml](https://github.com/SeydX/fritzbox/blob/c2d7865424e8985896d6724d56c1f919e1bec104/lib/request.js#L61) must be changed, otherwise requests over HTTPS will result in `self signed error`.

```js
const { requestXml } = require('@seydx/fritzbox/lib/request');

//BEFORE
async function myRequest() {
  try {
    const uri = 'https://<USERNAME>:<PASSWORD>@fritz.box:49443/<ENDPOINT>';
    const response = await requestXml({
      uri,
      {
        rejectUnauthorized: false
      }
    });
  } catch(err) {
    console.log(err);
  }
}


//AFTER
async function myRequest() {
  try {
    const uri = 'https://<USERNAME>:<PASSWORD>@fritz.box:49443/<ENDPOINT>';
    const response = await requestXml(uri, {
      https:{
        rejectUnauthorized: false
      }
    });
  } catch(err) {
    console.log(err);
  }
}
```

## Notable Changes
- The code has been refactored

## Other Changes
- Dependencies were updated

## Bugfixes
- Minor bugfixes
  
# v1.x
- Initial release (fork from [@ulfalfa](https://gitlab.com/ulfalfa/fritzbox))
