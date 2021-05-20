const { ClientDigestAuth } = require('@mreal/digest-auth');
const debug = require('debug')('fritzbox:request');
const got = require('got');
const { parseStringPromise } = require('xml2js');

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
      return await instance(uri, options);
    }

    return await got(uri, options);
  } catch (err) {
    if (err.response) {
      throw new Error(`Invalid response: ${err.response.statusCode} (${err.response.statusMessage})`);
    } else if (err.request) {
      throw new Error(`Cannot reach FritzBox. No response received. (${err.code})`);
    } else {
      throw new Error(err);
    }
  }
};

exports.requestXml = async (uri, options) => {
  debug('Request', {
    uri: uri,
    ...options,
  });

  const response = await this.request(uri, options);

  return await parseStringPromise(response.body, {
    explicitArray: false,
  });
};
