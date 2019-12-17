import * as requestOrig from 'request'
import { UriOptions, CoreOptions, UrlOptions, Response, Headers } from 'request'
export { UriOptions, CoreOptions, UrlOptions, Response, Headers } from 'request'

import { parseStringPromise as parseString } from 'xml2js'

import Debug from 'debug'
import { URL } from 'url'
const debug = Debug('ulfalfa:fritz:request')

export interface RequestOptions {
  method: 'GET' | 'POST' | 'SUBSCRIBE'
  url: URL
  headers: Headers
  body: any
}

export function request(
  options: (UriOptions & CoreOptions) | (UrlOptions & CoreOptions)
): Promise<Response> {
  return new Promise((resolve, reject) => {
    requestOrig(options, (error, response, _) => {
      if (!error) {
        if (response.statusCode !== 200) {
          reject(
            new Error(
              `Invalid response: ${response.statusCode}:${response.statusMessage}`
            )
          )
        } else {
          resolve(response)
        }
      } else {
        reject(error)
      }
    })
  })
}

export function requestXml(
  options: (UriOptions & CoreOptions) | (UrlOptions & CoreOptions)
): Promise<any> {
  debug('Request Options', options)
  return request(options).then(response =>
    parseString(response.body, {
      explicitArray: false,
    })
  )
}
