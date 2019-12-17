import Debug from 'debug'
import * as requestOrig from 'request'
import { CoreOptions, Headers, Response, UriOptions, UrlOptions } from 'request'
import { URL } from 'url'
import { parseStringPromise as parseString } from 'xml2js'
export { CoreOptions, Headers, Response, UriOptions, UrlOptions } from 'request'

const debug = Debug('ulfalfa:fritz:request')

export interface RequestOptions {
  method: 'GET' | 'POST' | 'SUBSCRIBE'
  url: URL
  headers: Headers
  body: any
}
/**
 * extends the original [request](https://github.com/request/request) by wrapping it
 * in a promise based version and throws an error if statuscode !=200
 *
 * @param options the (original request options)[https://github.com/request/request]
 */
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
/**
 * extends the original [request](https://github.com/request/request) by wrapping it
 * in a promise based version and throws an error if statuscode !=200.
 * Additionally it parses the response body with xml2js
 * @param options the [originalequest options](https://github.com/request/request)
 */
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
