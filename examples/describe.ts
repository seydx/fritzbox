import { Fritzbox } from '../src/lib/fritzbox'

const box = new Fritzbox({ username: 'test', password: 'testPwd123' })

box
  .describe()
  .then(console.log)
  .catch(err => {
    console.log(err)
  })
