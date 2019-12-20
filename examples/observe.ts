import { Fritzbox } from '../src/lib/fritzbox'

const box = new Fritzbox({
  username: 'test',
  password: 'testPwd123',
  eventAddress: '192.168.1.159',
  eventPort: 9999,
})

box.observe().subscribe(console.log, console.error)
