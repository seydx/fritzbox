import * as xmlbuilder from 'xmlbuilder'
import { request, requestXml } from './request'

import { extend } from 'underscore'

import {
  ServiceDescription,
  DeviceDescription,
  FritzboxOptions,
  Action,
} from './model'

import { URL } from 'url'
import Debug from 'debug'

const debug = Debug('ulfalfa:fritz:service')

const isInDirection = argument => argument.direction === 'in'

const isOutDirection = argument => argument.direction === 'out'

// const sendsEvents = stateVariable => stateVariable.$.sendEvents === 'yes'

const getInArguments = argumentList => {
  if (argumentList && Array.isArray(argumentList.argument)) {
    return argumentList.argument.filter(isInDirection).map(argument => {
      return argument.name
    })
  } else if (
    argumentList &&
    argumentList.argument &&
    isInDirection(argumentList.argument)
  ) {
    return [argumentList.argument.name]
  } else {
    return []
  }
}

const getOutArguments = argumentList => {
  if (argumentList && Array.isArray(argumentList.argument)) {
    return argumentList.argument.filter(isOutDirection).map(argument => {
      return argument.name
    })
  } else if (
    argumentList &&
    argumentList.argument &&
    isOutDirection(argumentList.argument)
  ) {
    return [argumentList.argument.name]
  } else {
    return []
  }
}

const buildSoapMessage = (action, serviceType, vars) => {
  const fqaction = 'u:' + action
  const root = {
    's:Envelope': {
      '@s:encodingStyle': 'http://schemas.xmlsoap.org/soap/encoding/',
      '@xmlns:s': 'http://schemas.xmlsoap.org/soap/envelope/',
      's:Body': {},
    },
  }
  root['s:Envelope']['s:Body'][fqaction] = {
    '@xmlns:u': serviceType,
  }
  extend(root['s:Envelope']['s:Body'][fqaction], vars)
  const xml = xmlbuilder.create(root)
  return xml.end()
}

export class Service implements ServiceDescription {
  protected initialized = false
  protected actions: Map<string, Action> = new Map()

  readonly serviceType: string
  readonly serviceId: string
  readonly controlURL: string
  readonly eventSubURL: string
  readonly SCPDURL: string

  constructor(serviceInfo: ServiceDescription, protected url: URL) {
    debug('Creating service', serviceInfo.serviceType, serviceInfo.serviceId)
    Object.assign(this, serviceInfo)
  }

  initialize(): Promise<Service> {
    if (this.initialized) {
      return Promise.resolve(this)
    } else {
      const url = this.url.origin + this.SCPDURL
      debug('Initialize Service@', url)
      return requestXml({
        url,
        rejectUnauthorized: false,
      }).then(result => {
        debug('Result', result)
        this.parseActions(result.scpd.actionList)
        this.initialized = true
        return this
      })
    }
  }

  protected parseActions(actionList) {
    debug('Actions', actionList)
    actionList.action.forEach(action => {
      // Create meta informations
      const myAction: Action = {
        actionName: action.name,
        inArgs: getInArguments(action.argumentList),
        outArgs: getOutArguments(action.argumentList),
      }
      debug(
        `Creating Action ${action.name} of ${this.serviceType} with parameters ${myAction.inArgs}`
      )
      this.actions.set(action.name, myAction)
    })
  }

  async execAction(actionName: string, vars: any = []) {
    debug(`Executing action ${this.serviceId}:${actionName}`, this.url.password)
    await this.initialize()

    const action = this.actions.get(actionName)

    if (!action) {
      debug('Available actions', this.actions.keys)
      throw new Error(`action ${actionName} of ${this.serviceType} not known`)
    }

    const body = buildSoapMessage(actionName, this.serviceType, vars)

    debug('Messagebody', body)
    const outArguments = this.actions.get(actionName).outArgs

    const uri = this.url.origin + this.controlURL

    const headers = {
      SoapAction: this.serviceType + '#' + actionName,
      'Content-Type': 'text/xml; charset="utf-8"',
    }
    debug('Headers', headers)

    return requestXml({
      method: 'POST',
      uri,
      auth: {
        user: this.url.username,
        pass: this.url.password,
        sendImmediately: false,
      },
      rejectUnauthorized: false,
      headers,
      body,
    }).then(result => {
      const res = {}
      const env = result['s:Envelope']

      const resultBody = env['s:Body']
      /* istanbul ignore else */
      if (resultBody['u:' + actionName + 'Response']) {
        const responseVars = resultBody['u:' + actionName + 'Response']
        /* istanbul ignore else */
        if (outArguments) {
          outArguments.forEach(arg => {
            res[arg] = responseVars[arg]
          })
        }
        return res
      } else {
        const fault = resultBody['s:Fault']
        const error = new Error('Device responded with fault ' + fault)
        throw error
      }
    })
  }
}
