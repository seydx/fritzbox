import { Fritzbox } from '../src/lib/fritzbox'

const box = new Fritzbox({ username: 'test', password: 'testPwd123' })

box
  .getAllHosts()
  .then(console.log)
  .catch(err => {
    console.log(err)
  })
