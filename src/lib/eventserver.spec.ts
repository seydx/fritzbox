import test from 'ava'
import * as request from 'request'
import { bufferCount, take } from 'rxjs/operators'
import { EventServer } from './eventserver'

test('can be initialized', t => {
  const es = new EventServer(9999, '127.0.0.1')

  t.is(es.callback, 'http://127.0.0.1:9999')
})

test('throws without port or address', t => {
  t.throws(
    () => new EventServer(undefined, '127.0.0.1'),
    'eventserver address and/or port missing'
  )
})

test('can listen for events', t => {
  const es = new EventServer(9999, '127.0.0.1')

  t.false(es.listening)

  es.listen()
  es.listen()
  t.true(es.listening)

  const promise = es
    .asObservable()
    .pipe(take(2), bufferCount(2))
    .toPromise()
    .then(data => {
      es.close()
      es.close()
      t.false(es.listening)
      t.deepEqual(data, [
        {
          data: '67',
          event: 'HostNumberOfEntries',
          sid: 'uuid:0cdbf2b8-1dd2-11b2-9edf-f7077a861cd8',
          service: undefined,
        },
        {
          data: '0',
          event: 'X_AVM-DE_ChangeCounter',
          sid: 'uuid:0cdbf2b8-1dd2-11b2-9edf-f7077a861cd8',
          service: undefined,
        },
      ])
    })

  request('http://127.0.0.1:9999', {
    headers: {
      nt: 'upnp:event',
      nts: 'upnp:propchange',
      sid: 'uuid:0cdbf2b8-1dd2-11b2-9edf-f7077a861cd8',
      seq: '0',
    },
    body:
      '<?xml version="1.0"?>\n' +
      '<e:propertyset xmlns:e="urn:dslforum-org:event-1-0">\n' +
      '<e:property>\n' +
      '<HostNumberOfEntries>67</HostNumberOfEntries></e:property>\n' +
      '<e:property>\n' +
      '<X_AVM-DE_ChangeCounter>0</X_AVM-DE_ChangeCounter></e:property>\n' +
      '</e:propertyset>\n' +
      '\u0000',
  })
  return promise
})
