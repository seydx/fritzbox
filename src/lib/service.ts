import Debug from 'debug'
import { extend } from 'underscore'
import { URL } from 'url'
import * as xmlbuilder from 'xmlbuilder'
import { Action, ServiceDescription, ServiceDescriptionExt } from './model'
import { requestXml, request } from './request'
import { ObjectUnsubscribedError } from 'rxjs'

const debug = Debug('ulfalfa:fritzbox:service')

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
/**
 * This class encapsulates a single service of fritzbox with all actions provided
 * by that service
 *
 * @export
 */
export class Service implements ServiceDescription {
  protected initialized = false
  protected actions: Map<string, Action> = new Map()
  protected events: string[] = []

  readonly serviceType: string
  readonly serviceId: string
  readonly controlURL: string
  readonly eventSubURL: string
  readonly SCPDURL: string

  readonly options: any

  protected timer: NodeJS.Timeout
  get subcriptionActive(): boolean {
    return !!this.timer
  }

  protected _sid: string
  get sid(): string {
    return this._sid
  }

  /**
   * Creates an instance of Service.
   * @param serviceInfo the service info as loaded from overview fritzbox xml
   * @param url the base url of the fritzbox (including protocoll and port, e.g. https://fritz.box:49443)
   */
  constructor(serviceInfo: ServiceDescription, protected url: URL, options: any) {
    this.options = options
    debug('Creating service', serviceInfo.serviceType, serviceInfo.serviceId)
    Object.assign(this, serviceInfo)
  }

  /**
   * initializes the service by requesting the detailed service information from the fritzbox
   *
   * @returns the service
   */
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
        this.parseStateVariables(result.scpd.serviceStateTable)
        this.initialized = true
        return this
      })
    }
  }
  /**
   * parseing the state variables for looking whether this services
   * provides events
   *
   */
  protected parseStateVariables(serviceStateTable) {
    if (
      serviceStateTable.stateVariable &&
      Array.isArray(serviceStateTable.stateVariable)
    ) {
      serviceStateTable.stateVariable
        .filter(sendsEvents)
        .forEach(stateVariable => {
          this.events.push(stateVariable.name)
          debug('Event', stateVariable)
        })
    }
  }
  /**
   * parses the actions from the service description aquired by [[Service.initialize]]
   *
   */
  protected parseActions(actionList) {
    debug('Actions', actionList, !!actionList.action)
    if (actionList && Array.isArray(actionList.action)) {
      actionList.action.forEach(action => {
        // Create meta informations
        const myAction: Action = {
          name: action.name,
          parameter: getInArguments(action.argumentList),
          return: getOutArguments(action.argumentList),
        }
        debug(
          `Creating Action ${action.name} of ${this.serviceType} with parameters ${myAction.parameter}`
        )
        this.actions.set(action.name, myAction)
      })
    }
  }

  /**
   * exec a single action from a service
   *
   * @param [vars={}] the parameters to be used
   * @returns the result of the action
   */
  async execAction(actionName: string, vars: object = {}) {
    debug(`Executing action ${this.serviceId}:${actionName}`, this.options.password)
    await this.initialize()

    const action = this.actions.get(actionName)

    if (!action) {
      debug('Available actions', this.actions.keys)
      throw new Error(`action ${actionName} of ${this.serviceType} not known`)
    }

    const body = buildSoapMessage(actionName, this.serviceType, vars)

    debug('Messagebody', body)
    const outArguments = this.actions.get(actionName).return

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
        user: this.options.username,
        pass: this.options.password,
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

  /**
   * retrieves a human readable description of the service with alle input
   * and out parameters
   */
  async describe(): Promise<ServiceDescriptionExt> {
    await this.initialize()
    return {
      serviceType: this.serviceType,
      serviceId: this.serviceId,
      controlURL: this.controlURL,
      eventSubURL: this.eventSubURL,
      SCPDURL: this.SCPDURL,
      actions: Array.from(this.actions.values()),
      events: this.events,
    }
  }

  subscribe(callbackUrl: string) {
    const uri = this.url.origin + this.eventSubURL
    debug(`Subscribing ${uri} to <${callbackUrl}>`)
    return request({
      method: 'SUBSCRIBE',
      uri,
      auth: {
        user: this.options.username,
        pass: this.options.password,
        sendImmediately: true,
      },
      rejectUnauthorized: false,
      headers: {
        CALLBACK: `<${callbackUrl}>`,
        NT: 'upnp:event',
        // TIMEOUT: 'Second-infinite',
      },
    }).then(response => {
      this.timer = setTimeout(async () => {
        await this.subscribe(callbackUrl)
      }, 1800000)
      this._sid = response.headers.sid as string
      debug('Subscribed with sid', this._sid)
      return {
        sid: this.sid,
        timeout: response.headers.timeout as string,
      }
    })
  }

  unsubscribe() {
    this._sid = undefined
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = undefined
    }
  }
}
