[![Build Status](https://travis-ci.org/devotis/node-clang.svg)](https://travis-ci.org/devotis/node-clang)
[![npm version](https://badge.fury.io/js/clang.svg)](https://www.npmjs.org/package/clang)

node-clang
==========

Using <a href="http://www.createaclang.com/">Clang</a>'s SOAP api? Here's a module that will make your life easier. A Node.js api that wraps Clang's SOAP api. You don't need to bother with the extra resource callbacks that some methods like customer_getByObject require. Internally these resources are polled and the final dataset is returned in the callback.

I had a ton of fun building this. Node.js rocks!

## Install

```javascript
npm install clang
```

## 1.0 breaking changes
- instantiation without new keyword is not possible anymore.
- config.normalizeOptionFields does not default to true anymore. It doesn't default at all.
- config.logRequests is renamed to config.logPayload and also logs raw xml output
- customer_getById and similar methods that would normally output an object have always been wrapped in an array by this module. From 1.0 on when single objects are expected they are no longer wrapped in an array. methods that would normally output an array like customer_getAll, but output just one because of the available data (and/or filter set) continue to be wrapped in an array.

## 1.0 new features
- You can supply `_allPages=true` in the clang.request params. Internally all pages will be fetched, normalized and concatenated into one array containing the results of all pages.
- The default platform is `secure`, but you can now configure it to be `login`.
```javascript
const clang = new Clang({
  uuid: '12345678-1234-1234-1234-123456781234',
  platform: 'login'
})
```

## Example
```javascript
const Clang = require('clang')
const clang = new Clang({
  uuid: '12345678-1234-1234-1234-123456781234'
})

clang.request('group_getMembers', {
  groupId: 2
}, (err, result) => {
  console.log(err, result)
})

// Paging using the special parameters _size and _offset. Defaults are 50 and 0
clang.request('customer_getAll', {
  _size: 10
}, (err, result) => {
  console.log(err, result)
})

// Let the clang request do the paging for you and get all results back
clang.request('customer_getAll', {
  _allPages: true
}, (err, result) => {
  console.log(err, result)
})


```

## WSDL
This is the underlying WSDL document.

https://secure.myclang.com/app/api/soap/public/index.php?wsdl
