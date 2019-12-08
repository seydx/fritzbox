import * as requestOrig from 'request'
import { UriOptions, CoreOptions, UrlOptions, Response } from 'request'
export { UriOptions, CoreOptions, UrlOptions, Response } from 'request'
export function request(
  options: (UriOptions & CoreOptions) | (UrlOptions & CoreOptions)
): Promise<Response> {
  return new Promise((resolve, reject) => {
    requestOrig(options, (error, response, _) => {
      if (!error) {
        resolve(response)
      } else {
        reject(error)
      }
    })
  })
}
