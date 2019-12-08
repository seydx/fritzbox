import test from 'ava'

import { mainFunc } from './index'

test('mainFunc works', t => {
  t.is(mainFunc(2), 4)
})
