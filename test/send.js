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
  let externalId = Date.now()+''
  let emailAddress = config.get('tester.emailAddress')

  async.autoInject({
    deleteAll: clang.deleteAll.bind(clang, 'customer'),
    createCustomer: function(deleteAll, cb) {
      clang.request('customer_insert', {customer: {externalId}}, cb)
    },
    createEmail: function(createCustomer, cb) {
      clang.request('email_create', cb)
    },
    insertEmail: function(createEmail, cb) {
      let email = Object.assign({}, createEmail, {
        name: 'test-name',
        fromName: 'Smith',
        fromAddress: 'user@example.com',
        subject: 'test-name',
        htmlContent: `<html><body><h1>Newsletter</h1>HTML body</body></html>`,
        textContent: 'Newsletter text body'
      })
      clang.request('email_insert', {email}, cb)
    },
    send: function(insertEmail, cb) {
      clang.send({
        emailAddress,
        externalId
      }, {
        lookup: 'externalId',
        create: true, // Nog een test case maken waarbij je de melding krijgt:  Customer not found and create is not allowed
        context: 'email',
        contextId: insertEmail.id
      }, cb)
    }
  }, (err, result) => {
    t.notOk(err, 'No error occured')
    t.ok(lib.isObject(result.createEmail), 'The `create` result is a non-empty object')
    t.ok(lib.isObject(result.insertEmail), 'The `insert` result is a non-empty object')
    t.ok(lib.isObject(result.send), 'The `send` result is a non-empty object')
    t.ok(lib.isObject(result.send.get), 'The send object returns a `get` key for the customer that was retrieved')
    t.ok(result.send.upsertMethodName && result.send.upsertMethodName.match(/^customer_(update|insert)$/), 'The send object returns a `upsertMethodName` key indicating if an existing customer was updated or a new one inserted')
    t.ok(lib.isObject(result.send.upsert), 'The send object returns a `upsert` key for the customer data after it was updated')
    t.equal(result.createCustomer.externalId, result.send.upsert.externalId, 'externalId of the created customer and updated one are the same')
    t.equal(result.send.upsertMethodName, 'customer_update', 'A customer update occured as opposed to a customer insert')
    t.equal(result.send.send, true, 'Sending the email succeeded albeit the true is not conclusive about if sending actually worked')
    t.end()
  })
})
