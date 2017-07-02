'use strict'
process.env.NODE_ENV = 'test'

const config = require('config')
const tape = require('tape')
const async = require('async')
const Clang = require('../')
let clang = new Clang({
  version: '*',
  uuid: config.get('uuid'),
  logPayload: false
})

const lib = require('./lib');

tape('before', function (t) {
  async.autoInject({
    createEmail: function(cb) {
      clang.request('email_create', cb)
    },
    insertEmail: ['createEmail', function(createEmail, cb) {
      let email = Object.assign({}, createEmail, {
        name: 'test-name',
        htmlContent: 'test-htmlContent'
      })
      clang.request('email_insert', {email}, cb)
    }],
    send: ['insertEmail', function(insertEmail, cb) {
      clang.send({
        emailAddress: 'c.westerbeek@gmail.com',
        externalId: '123'
      }, {
        lookup: 'externalId',
        create: true, // Nog een test case maken waarbij je de melding krijgt:  Customer not found and create is not allowed
        context: 'email',
        contextId: insertEmail.id
      }, cb)
    }]
  }, (err, result) => {
    t.notOk(err, 'No error occured')
    t.ok(result.create)
    t.ok(lib.isObject(result.create), 'The create result is a non-empty object')
    t.ok(lib.isObject(result.insert2), 'The insert result is a non-empty object')
    t.end()
  })
})
