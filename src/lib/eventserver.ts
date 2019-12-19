import { Server, createServer } from 'http'

import { URL } from 'url'

import { request } from './request'
import { parseStringPromise as parseString } from 'xml2js'

import Debug from 'debug'
import { EventEmitter } from 'events'
import { using, Observable, Subject, Unsubscribable } from 'rxjs'
import { publish, share } from 'rxjs/operators'
import { FritzEvent } from './model'

const debug = Debug('ulfalfa:fritzbox:eventserver')
export interface Event {
  type: string
  payload: any
}
/**
 * provides an http server that handles request from subscribed events.
 * parses the xml and emit via an observable
 */
export class EventServer {
  protected readonly server: Server

  readonly url: URL

  get listening(): boolean {
    return this.server.listening
  }

  get callback(): string {
    return `http://${this.address}:${this.port}`
  }

  constructor(
    protected readonly port: number,
    protected readonly address: string
  ) {
    this.server = createServer()
  }

  protected messages = new Subject<FritzEvent>()

  protected async parseEvent(eventXml: string, sid: string, seq: number) {
    const eventData = await parseString(eventXml, {
      explicitArray: false,
    })

    let properties = eventData['e:propertyset']['e:property']

    debug('Processing', properties)

    if (!Array.isArray(properties)) {
      properties = [properties]
    }
    properties.forEach(prop => {
      const event = Object.keys(prop)[0]
      debug('Emitting', event)
      this.messages.next({ event, data: prop[event], sid, service: undefined })
    })
  }

  /**
   * starts listening at the specified interface and port
   */

  listen() {
    debug('Listening')
    if (!this.listening) {
      this.server.listen(this.port, () => {
        this.server.on('request', (req, res) => {
          this.handleRequest(req, res)
        })
      })
    }
  }
  /**
   * stops listening to events
   */
  close() {
    if (this.listening) {
      debug('stop listening')
      this.server.close()
      this.server.removeAllListeners()
    }
  }

  /**
   * getting the obsevable for the events
   */
  asObservable(): Observable<FritzEvent> {
    return this.messages.asObservable()
  }

  protected handleRequest(req, res) {
    let body: any = []

    req
      .on('data', chunk => {
        body.push(chunk)
      })
      .on('end', () => {
        body = Buffer.concat(body).toString()
        // at this point, `body` has the entire request body stored in it as a string
        this.parseEvent(body, req.headers.sid, req.headers.seq)
      })
    res.end()
  }
}
