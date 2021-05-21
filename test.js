const Fritzbox = require('./lib/fritzbox');
const fritzbox = new Fritzbox({ url: '192.168.178.1', username: 'Seyd55', password: 'Samsun55' });

// Async/Await:
async function getDeviceInfo() {
  try {
    const info = await fritzbox.exec('urn:DeviceInfo-com:serviceId:DeviceInfo1', 'GetInfo');
    console.log(info);
  } catch (err) {
    console.error(err);
  }
}

getDeviceInfo();
