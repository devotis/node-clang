'use strict'
process.env.NODE_ENV = 'test'

const tape = require('tape')
const async = require('async')
const Clang = require('../')
let clang = new Clang({version: '*'})

const lib = require('./lib');

tape('Class instantiation', (t) => {
  t.equal(clang instanceof Clang, true, 'Clang instantiation should work')

  t.throws(function() {
    Clang()
  }, 'Clang instantiation without new keyword should not work')
  t.end()
})

tape('Request signature', (t) => {
  async.parallel([
    (cb) => {
      clang.request(function(err) {
        t.ok(err, 'Request without methodName and arguments should callback with an error')
        cb()
      })
    },
    (cb) => {
      clang.request('someMethod', function(err) {
        t.ok(err, 'Request without uuid in arguments should callback with an error')
        cb()
      })
    },
    (cb) => {
      clang.request('someMethod', 'this-should-be-an-object', function(err) {
        t.ok(err, 'Request with non-object as 2nd argument (args) should callback with an error')
        cb()
      })
    }
  ], () => {
    t.end()
  })
})

tape('Send signature', (t) => {
  async.parallel([
    (cb) => {
      clang.send((err) => {
        t.ok(err, 'Send requires 3 arguments or else should callback with an error')

        cb()
      })
    },
    (cb) => {
      clang.send({}, {}, (err) => {
        t.ok(err, 'Empty customer object should callback with an error')

        cb()
      })
    },
    (cb) => {
      clang.send({externalId: 1}, {lookup: 'some-unsupported-key'}, (err) => {
        t.ok(err, 'Send with unsupport lookup key should callback with an error')

        cb()
      })
    },
    (cb) => {
      clang.send({externalId: 1}, {context: 'group'}, (err) => {
        t.ok(err, 'Send with context without contextId should callback with an error')

        cb()
      })
    },
    (cb) => {
      clang.send({externalId: 1}, {context: 'some-unsupported-context'}, (err) => {
        t.ok(err, 'Send with unsupported context should callback with an error')

        cb()
      })
    },
    (cb) => {
      clang.send({x: 1}, {lookup: 'externalId', context: 'group'}, (err) => {
        t.ok(err, 'Send with lookup=externalId without an externalId should callback with an error')

        cb()
      })
    },
    (cb) => {
      clang.send({x: 1}, {lookup: 'customerId', context: 'group'}, (err) => {
        t.ok(err, 'Send with lookup=customerId without an id/customerId should callback with an error')

        cb()
      })
    },
    (cb) => {
      clang.send({x: 1}, {lookup: 'email', context: 'group'}, (err) => {
        t.ok(err, 'Send with lookup=email without an email/emailAddress should callback with an error')

        cb()
      })
    }
  ], () => {
    t.end()
  })
})

tape('Request validity', (t) => {
  async.parallel([
    (cb) => {
      clang.request('someMethod', {uuid: '123'}, function(err) {
        t.ok(err, 'Request with undefined method should callback with an error')
        cb()
      })
    },
    (cb) => {
      clang.request('customer_getById', {uuid: '123'}, function(err) {
        t.ok(err, 'Request with incorrect uuid should callback with an error')
        t.equal(lib.faultcode(err), 202, 'With is a SOAP Fault with faultcode 202')
        cb()
      })
    }
  ], () => {
    t.end()
  })
})

tape('Request validity promise', (t) => {
  let isCalled = function() {
    isCalled = true
  }

  async.parallel([
    (cb) => {
      clang.request('someMethod', {uuid: '123'})
      .then(isCalled)
      .catch(err => {
        t.ok(err, 'Request with undefined method should callback with an error')
        cb()
      })
    },
    (cb) => {
      clang.request('customer_getById', {uuid: '123'})
      .then(isCalled)
      .catch(err => {
        t.ok(err, 'Request with incorrect uuid should callback with an error')
        t.equal(lib.faultcode(err), 202, 'With is a SOAP Fault with faultcode 202')
        cb()
      })
    }
  ], () => {
    t.notEqual(isCalled, true, 'The promise did resolve which was unexpected')
    t.end()
  })
})
