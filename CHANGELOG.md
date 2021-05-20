# Changelog

# v2.0.0 - 2021-05-20

## Other Changes
- The code has been refactored
  - Switched from `request` to `got`
  - `rejectUnauthorized` needs to be changed from `await requestXml({uri, { rejectUnauthorized: false } })` to `await requestXml(uri, { https: { rejectUnauthorized: false } });`
- Other bug fixes
- Dependencies were updated
  
# v1.x
- Initial release (fork from [@ulfalfa](https://gitlab.com/ulfalfa/fritzbox))