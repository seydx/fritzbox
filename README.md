# @seydx/fritzbox

> A promise based library for accessing a fritzbox via TR-064 API of an AVM Fritz!Box. Forked from [@ulfalfa](https://gitlab.com/ulfalfa/fritzbox)

## Features

This library is capable of:

- Supports the complete command language of the TR-064 API of an Fritz!Box
- No callback, only promises
- SSL encryption and authentication

## Install

```
npm install @seydx/fritzbox
```

## Usage

### Getting the info about the fritzbox

With the method `exec` you can access all services and actions in the fritz box even with parameters

```js
const Fritzbox = require('@seydx/fritzbox');
const fritzbox = new Fritzbox({ username: 'test', password: 'testPwd123' });

// Async/Await:
async function getDeviceInfo () {
  try {
    const info = await fritzbox.exec(
      'urn:dslforum-org:service:DeviceInfo:1',
      'GetInfo'
    );
    console.log(info);
  } catch (err) {
    console.error(err);
  }
}
```

### Getting all currently known hosts by Fritz!Box

```js
const Fritzbox = require('@seydx/fritzbox');
const fritzbox = new Fritzbox({ username: 'test', password: 'testPwd123' });

// Async/Await:
async function getHosts () {
  try {
    const allHosts = await fritzbox.getAllHosts();
    console.log(allHosts);
  } catch (err) {
    console.error(err);
  }
}
```

### Retrieving all services with their corresponding actions

```js
const Fritzbox = require('@seydx/fritzbox');
const fritzbox = new Fritzbox({ username: 'test', password: 'testPwd123' });

// Async/Await:
async function getServices () {
  try {
    const services = await fritzbox.describe();
    console.log(services);
  } catch (err) {
    console.error(err);
  }
}
```
