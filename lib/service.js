const debug = require('debug')('fritzbox:service');
const xmlbuilder = require('xmlbuilder');

const { requestXml } = require('./request');

const isInDirection = (argument) => argument.direction === 'in';
const isOutDirection = (argument) => argument.direction === 'out';

const getInArguments = (argumentList) => {
  if (argumentList && Array.isArray(argumentList.argument)) {
    return argumentList.argument.filter(isInDirection).map((argument) => argument.name);
  } else if (argumentList && argumentList.argument && isInDirection(argumentList.argument)) {
    return [argumentList.argument.name];
  } else {
    return [];
  }
};

const getOutArguments = (argumentList) => {
  if (argumentList && Array.isArray(argumentList.argument)) {
    return argumentList.argument.filter(isOutDirection).map((argument) => argument.name);
  } else if (argumentList && argumentList.argument && isOutDirection(argumentList.argument)) {
    return [argumentList.argument.name];
  } else {
    return [];
  }
};

const buildSoapMessage = (action, serviceType, vars) => {
  const fqaction = 'u:' + action;

  const root = {
    's:Envelope': {
      '@s:encodingStyle': 'http://schemas.xmlsoap.org/soap/encoding/',
      '@xmlns:s': 'http://schemas.xmlsoap.org/soap/envelope/',
      's:Body': {},
    },
  };

  root['s:Envelope']['s:Body'][fqaction] = {
    '@xmlns:u': serviceType,
    ...vars,
  };

  const xml = xmlbuilder.create(root);

  return xml.end();
};

class Service {
  constructor(serviceInfo, url, options) {
    this.actions = new Map();

    this.url = url;
    this.options = options;

    Object.assign(this, serviceInfo);
    debug('Creating service', serviceInfo.serviceType, serviceInfo.serviceId);

    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    const url = this.url.origin + this.SCPDURL;
    debug('Initialize Service@', url);

    const result = await requestXml(url, {
      https: {
        rejectUnauthorized: false,
      },
    });

    debug('Result', result);

    this.parseActions(result.scpd.actionList);
    this.initialized = true;

    return;
  }

  parseActions(actionList) {
    debug('Actions', actionList, !!actionList.action);

    if (actionList && Array.isArray(actionList.action)) {
      actionList.action.forEach((action) => {
        // Create meta informations
        const myAction = {
          name: action.name,
          parameter: getInArguments(action.argumentList),
          return: getOutArguments(action.argumentList),
        };

        debug(
          `Creating Action ${action.name} of ${this.serviceType} ${
            myAction.parameter.length ? 'with parameters' : 'without parameters'
          } ${myAction.parameter}`
        );
        this.actions.set(action.name, myAction);
      });
    }
  }

  async execAction(actionName, vars = {}) {
    debug(`Executing action ${this.serviceId}:${actionName}`, this.options.password);
    await this.initialize();

    const action = this.actions.get(actionName);

    if (!action) {
      debug('Available actions', this.actions.keys);
      throw new Error(`Action "${actionName}" of "${this.serviceType}" not known!`);
    }

    const body = buildSoapMessage(actionName, this.serviceType, vars);
    debug('Messagebody', body);

    const outArguments = this.actions.get(actionName).return;
    const uri = this.url.origin + this.controlURL;

    const headers = {
      SoapAction: this.serviceType + '#' + actionName,
      'Content-Type': 'text/xml; charset="utf-8"',
    };
    debug('Headers', headers);

    const result = await requestXml(uri, {
      method: 'POST',
      username: this.options.username,
      password: this.options.password,
      sendImmediately: false,
      https: {
        rejectUnauthorized: false,
      },
      headers: headers,
      body: body,
    });

    const res = {};
    const env = result['s:Envelope'];

    const resultBody = env['s:Body'];
    if (resultBody['u:' + actionName + 'Response']) {
      const responseVars = resultBody['u:' + actionName + 'Response'];
      if (outArguments) {
        outArguments.forEach((arg) => {
          res[arg] = responseVars[arg];
        });
      }
      return res;
    } else {
      throw new Error(`Device responded with fault ${resultBody['s:Fault']}`);
    }
  }

  async describe() {
    await this.initialize();

    return {
      serviceType: this.serviceType,
      serviceId: this.serviceId,
      controlURL: this.controlURL,
      SCPDURL: this.SCPDURL,
      actions: Array.from(this.actions.values()),
    };
  }
}

module.exports = Service;
