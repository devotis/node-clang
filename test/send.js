'use strict'
process.env.NODE_ENV = 'test'

const config = require('config')
const tape = require('tape')
const async = require('async')
const Clang = require('../')
let clang = new Clang({
  version: '*',
  uuid: config.get('uuid'),
  logPayload: false,
  debug: false
})

const lib = require('./lib');

tape('Sending to an existing customer', function (t) {
  async.autoInject({
    createCustomer: function(cb) {
      clang.request('customer_insert', {customer: {externalId: '123'}}, cb)
    },
    createEmail: function(cb) {
      clang.request('email_create', cb)
    },
    insertEmail: ['createEmail', function(createEmail, cb) {
      let email = Object.assign({}, createEmail, {
        name: 'test-name',
        fromName: 'Smith',
        fromAddress: 'user@example.com',
        subject: 'test-name',
        htmlContent: `<html><body><h1>Newsletter</h1>HTML body</body></html>`,
        textContent: 'Newsletter text body'
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
    console.log(result)
    t.notOk(err, 'No error occured')
    t.ok(lib.isObject(result.createEmail), 'The create result is a non-empty object')
    t.ok(lib.isObject(result.insertEmail), 'The insert result is a non-empty object')
    t.equal(result.send, true, 'Sending the email succeeded albeit the true is not conclusive about if sending actually worked')
    t.end()
  })
})
