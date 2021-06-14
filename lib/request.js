'use strict';

const { ClientDigestAuth } = require('@mreal/digest-auth');
const debug = require('debug')('fritzbox:request');
const got = require('got');
const cheerio = require('cheerio');
const querystring = require('querystring');
const { parseStringPromise } = require('xml2js');

const parseOutput = (data, target) => {
  let $ = cheerio.load(data);
  let elements = $('input').toArray();

  const element = elements.find((el) => el.attribs.name === target) || {};

  return element.attribs;
};

exports.createDigestClient = (username, password) => {
  return got.extend({
    hooks: {
      afterResponse: [
        (res, retry) => {
          const options = res.request.options;
          const digestHeader = res.headers['www-authenticate'];

          if (!digestHeader) {
            return res;
          }

          const incomingDigest = ClientDigestAuth.analyze(digestHeader);

          debug('Incoming digest', incomingDigest);

          const digest = ClientDigestAuth.generateProtectionAuth(incomingDigest, username, password, {
            method: options.method,
            uri: options.url.pathname,
            counter: 1,
          });

          options.headers.authorization = digest.raw;

          return retry(options);
        },
      ],
      beforeRetry: [
        (options, error, retryCount) => {
          debug('Retry Digest', options.headers, error, retryCount);
        },
      ],
    },
  });
};

exports.request = async (uri, options) => {
  try {
    if (!options.sendImmediately && options.username && options.password) {
      const instance = this.createDigestClient(options.username, options.password);

      //IMPORTANT: Encode username/password AFTER creating digest client
      options.username = encodeURI(options.username);
      options.password = encodeURI(options.password);

      return await instance(uri, options);
    }

    return await got(uri, options);
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Invalid response: ${err.response.url || uri} - ${err.response.statusMessage} (${err.response.statusCode})`
      );
    } else if (err.request) {
      throw new Error(`No or invalid response: ${err.request.requestUrl || uri} - ${err.message} (${err.code})`);
    } else {
      throw new Error(err);
    }
  }
};

exports.requestAHA = async (host, ain, sid, cmd) => {
  const uri = `http://${host}/webservices/homeautoswitch.lua`;

  debug('Request AHA', {
    uri: uri,
    ain: ain,
    sid: sid,
    switchcmd: cmd,
  });

  try {
    const response = await got(uri, {
      method: 'GET',
      searchParams: {
        ain: ain,
        sid: sid,
        switchcmd: cmd,
      },
    });

    return response.body;
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Invalid response: ${err.response.url || uri} - ${err.response.statusMessage} (${err.response.statusCode})`
      );
    } else if (err.request) {
      throw new Error(`No or invalid response: ${err.request.requestUrl || uri} - ${err.message} (${err.code})`);
    } else {
      throw new Error(err);
    }
  }
};

exports.requestLUA = async (params, host, path, target, exec) => {
  const uri = `http://${host}${path}`;

  debug('Request LUA', {
    uri: uri,
    params: params,
    target: target,
    exec: exec,
  });

  try {
    const response = await got.post(uri, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: querystring.stringify(params),
    });

    if (target && !exec) {
      return parseOutput(response.body, target);
    }

    let body = response.body;

    try {
      body = JSON.parse(response.body);
    } catch {
      //unhandled
    }

    return body;
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Invalid response: ${err.response.url || uri} - ${err.response.statusMessage} (${err.response.statusCode})`
      );
    } else if (err.request) {
      throw new Error(`No or invalid response: ${err.request.requestUrl || uri} - ${err.message} (${err.code})`);
    } else {
      throw new Error(err);
    }
  }
};

exports.requestXml = async (uri, options) => {
  debug('Request XML', {
    uri: uri,
    ...options,
  });

  const response = await this.request(uri, options);

  return await parseStringPromise(response.body, {
    explicitArray: false,
  });
};
