import { parseStringPromise as parseString } from 'xml2js'
import * as xmlbuilder from 'xmlbuilder'
import { request } from './request'

import { extend } from 'underscore'

import { ServiceDescription, DeviceDescription } from './model'

import Debug from 'debug'
const debug = Debug('ulfalfa:fritz:service')

const isInDirection = argument => argument.direction === 'in'

const isOutDirection = argument => argument.direction === 'out'

const sendsEvents = stateVariable => stateVariable.$.sendEvents === 'yes'

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

export class Service {
  constructor(
    public readonly meta: ServiceDescription,
    protected deviceInfo: DeviceDescription,
    protected connectionInfo
  ) {
    debug('Creating service', meta.serviceType)
    this.deviceInfo = deviceInfo
    this.connectionInfo = connectionInfo
    this.actions = {}
    this.actionsInfo = {}
    this.stateVariables = {}
  }

  actions: any
  actionsInfo: any
  stateVariables: any

  subscribe() {
    return this._sendSubscriptionRequest()
  }
  initialize(): Promise<Service> {
    const that = this

    const url =
      (that.connectionInfo.ssl ? 'https://' : 'http://') +
      that.connectionInfo.host +
      ':' +
      that.connectionInfo.port +
      that.meta.SCPDURL
    debug('Initialize Service@', url)
    return request({
      url,
      rejectUnauthorized: false,
    })
      .then(response => {
        if (response.statusCode === 200) {
          return parseString(response.body, {
            explicitArray: false,
          })
        } else {
          throw new Error('Invalid Result')
        }
      })
      .then(result => {
        debug('Parsing actions')
        that._parseActions(result.scpd.actionList)
        that._parseStateVariables(result.scpd.serviceStateTable)
        return this
      })
  }
  _parseActions(actionList) {
    const that = this
    if (Array.isArray(actionList.action)) {
      actionList.action.forEach(action => {
        // Create meta informations
        that.actionsInfo[action.name] = {}
        that.actionsInfo[action.name].inArgs = getInArguments(
          action.argumentList
        )
        that.actionsInfo[action.name].outArgs = getOutArguments(
          action.argumentList
        )

        // Bind action
        that.actions[action.name] = vars => {
          vars = vars ? vars : []
          return that._sendSOAPActionRequest(
            that.deviceInfo,
            that.meta.controlURL,
            that.meta.serviceType,
            action.name,
            that.actionsInfo[action.name].inArgs,
            that.actionsInfo[action.name].outArgs,
            vars
          )
        }
      })
    }
  }
  _parseStateVariables(serviceStateTable) {
    const that = this
    if (
      serviceStateTable.stateVariable &&
      Array.isArray(serviceStateTable.stateVariable)
    ) {
      serviceStateTable.stateVariable
        .filter(sendsEvents)
        .forEach(stateVariable => {
          that.stateVariables[stateVariable.name] = stateVariable
          delete stateVariable.$
        })
    }
  }

  _sendSubscriptionRequest() {
    const that = this

    const uri =
      (that.connectionInfo.ssl ? 'https://' : 'http://') +
      that.connectionInfo.host +
      ':' +
      that.connectionInfo.port +
      that.meta.eventSubURL

    return request({
      method: 'SUBSCRIBE',
      uri,
      auth: that.connectionInfo.auth,
      rejectUnauthorized: false,
      headers: {
        CALLBACK:
          '<http://' +
          that.connectionInfo.serverAddress +
          ':' +
          that.connectionInfo.serverPort +
          '>',
        NT: 'upnp:event',
        TIMEOUT: 'Second-infinite',
      },
    }).then(response => {
      if (response.statusCode === 200) {
        return response.headers.sid
      } else {
        throw new Error(
          `Invalid response: ${response.statusCode}:${response.statusMessage}`
        )
      }
    })
  }
  _sendSOAPActionRequest(
    device,
    url,
    serviceType,
    action,
    inArguments,
    outArguments,
    vars
  ) {
    const that = this

    const messageBody = buildSoapMessage(action, serviceType, vars)
    const agentOptions = null

    const uri =
      (that.connectionInfo.ssl ? 'https://' : 'http://') +
      that.connectionInfo.host +
      ':' +
      that.connectionInfo.port +
      url

    return request({
      method: 'POST',
      uri,
      auth: that.connectionInfo.auth,
      agentOptions,
      rejectUnauthorized: false,
      headers: {
        SoapAction: serviceType + '#' + action,
        'Content-Type': 'text/xml; charset="utf-8"',
      },
      body: messageBody,
    })
      .then(response => {
        if (response.statusCode === 200) {
          return parseString(response.body, {
            explicitArray: false,
          })
        } else {
          throw new Error(
            `Invalid response: ${response.statusCode}:${response.statusMessage}`
          )
        }
      })
      .then(result => {
        const res = {}
        const env = result['s:Envelope']
        if (env['s:Body']) {
          const body = env['s:Body']
          if (body['u:' + action + 'Response']) {
            const responseVars = body['u:' + action + 'Response']
            if (outArguments) {
              outArguments.forEach(arg => {
                res[arg] = responseVars[arg]
              })
            }
          } else if (body['s:Fault']) {
            const fault = body['s:Fault']
            const error = new Error('Device responded with fault ' + fault)
            throw error
          }
          return res
        }
      })
  }
}
