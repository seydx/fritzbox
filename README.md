# @seydx/fritzbox

> A promise based library for accessing a fritzbox via TR-064 API of an AVM Fritz!Box written in typescript. Forked from @ulfalfa

## Features

This library is capable of:

- Supports the complete command language of the TR-064 API of an Fritz!Box
- No callback, only promises
- SSL encryption and authentication
- some typed convenience functions (will be extended in future version)

## Install

```
npm install @ulfalfa/fritzbox
```

## Usage

### Getting the info about the fritzbox

With the method `exec` you can access all services and actions in the fritz box even with parameters

```typescript
import { Fritzbox } from './lib/fritzbox'

const fritzbox = new Fritzbox({ username: 'test', password: 'testPwd123' })

const info = await fritzbox.exec(
  'urn:dslforum-org:service:DeviceInfo:1',
  'GetInfo'
)
```

### Getting all currently known hosts by Fritz!Box

```typescript
import { Fritzbox } from './lib/fritzbox'

const fritzbox = new Fritzbox({ url: 'https://test:testPwd123@fritz.box:49433' })

const allHosts = await fritzbox.getAllHosts();

```

### Retrieving all services with their corresponding actions

```typescript
import { Fritzbox } from './lib/fritzbox'

const fritzbox = new Fritzbox({ username: 'test', password: 'testPwd123' })

const info = await fritzbox.describe()
)
```

## Documentation

Will be provided a typedoc page in [gitlab pages](https://ulfalfa.gitlab.io/fritzbox/)
