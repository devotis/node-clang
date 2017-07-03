'use strict'
process.env.NODE_ENV = 'test'

const config = require('config')
const tape = require('tape')
const async = require('async')
const Clang = require('../')
let clang = new Clang({
  version: '*',
  uuid: config.get('uuid'),
  normalizeOptionFields: true,
  logPayload: false,
  debug: false
})

const lib = require('./lib');

tape('Send email to an existing customer', function (t) {
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

tape('Send email to an new customer', function (t) {
  let externalId = Date.now()+''
  let emailAddress = config.get('tester.emailAddress')

  async.autoInject({
    deleteAll: clang.deleteAll.bind(clang, 'customer'),
    createEmail: function(cb) {
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
    sendThatFails: function(insertEmail, cb) {
      clang.send({
        emailAddress,
        externalId
      }, {
        lookup: 'externalId',
        context: 'email',
        contextId: insertEmail.id
      }, (err) => {
        t.ok(err, 'An error should occur, because in the send options create: true is missing')
        cb()
      })
    },
    send: function(insertEmail, cb) {
      clang.send({
        emailAddress,
        externalId
      }, {
        lookup: 'externalId',
        create: true,
        context: 'email',
        contextId: insertEmail.id
      }, cb)
    }
  }, (err, result) => {
    t.notOk(err, 'No error occured')
    t.ok(lib.isObject(result.createEmail), 'The `create` result is a non-empty object')
    t.ok(lib.isObject(result.insertEmail), 'The `insert` result is a non-empty object')
    t.ok(lib.isObject(result.send), 'The `send` result is a non-empty object')
    t.equal(result.send.get, null, 'No customer was found so')
    t.ok(result.send.upsertMethodName && result.send.upsertMethodName.match(/^customer_(update|insert)$/), 'The send object returns a `upsertMethodName` key indicating if an existing customer was updated or a new one inserted')
    t.ok(lib.isObject(result.send.upsert), 'The send object returns a `upsert` key for the customer data after it was updated')
    t.equal(result.send.upsert.externalId, externalId, 'externalId of the created customer and updated one are the same')
    t.equal(result.send.upsertMethodName, 'customer_insert', 'A customer insert occured as opposed to a customer update')
    t.equal(result.send.send, true, 'Sending the email succeeded albeit the true is not conclusive about if sending actually worked')
    t.end()
  })
})

tape('Send existing customer to group', function (t) {
  let externalId = Date.now()+''
  let groupName = `testgroup-${externalId}`
  let emailAddress = config.get('tester.emailAddress')

  async.autoInject({
    createCustomer: function(cb) {
      clang.request('customer_insert', {customer: {externalId}}, cb)
    },
    insertGroup: function(cb) {
      clang.request('group_insert', {group: {
        name: groupName
      }}, cb)
    },
    send: function(insertGroup, cb) {
      clang.send({
        emailAddress,
        externalId
      }, {
        lookup: 'externalId',
        context: 'group',
        contextId: insertGroup.id
      }, cb)
    }
  }, (err, result) => {
    t.notOk(err, 'No error occured')
    t.ok(lib.isObject(result.insertGroup), 'The `insert` result is a non-empty object')
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

tape('Send new customer to group', function (t) {
  let externalId = Date.now()+''
  let groupName = `testgroup-${externalId}`
  let emailAddress = config.get('tester.emailAddress')

  async.autoInject({
    deleteAll: clang.deleteAll.bind(clang, 'customer'),
    insertGroup: function(cb) {
      clang.request('group_insert', {group: {
        name: groupName
      }}, cb)
    },
    sendThatFails: function(insertGroup, cb) {
      clang.send({
        emailAddress,
        externalId
      }, {
        lookup: 'externalId',
        context: 'email',
        contextId: insertGroup.id
      }, (err) => {
        t.ok(err, 'An error should occur, because in the send options create: true is missing')
        cb()
      })
    },
    send: function(insertGroup, cb) {
      clang.send({
        emailAddress,
        externalId
      }, {
        lookup: 'externalId',
        create: true,
        context: 'group',
        contextId: insertGroup.id
      }, cb)
    }
  }, (err, result) => {
    t.notOk(err, 'No error occured')
    t.ok(lib.isObject(result.insertGroup), 'The `insert` result is a non-empty object')
    t.ok(lib.isObject(result.send), 'The `send` result is a non-empty object')
    t.equal(result.send.get, null, 'No customer was found so')
    t.ok(result.send.upsertMethodName && result.send.upsertMethodName.match(/^customer_(update|insert)$/), 'The send object returns a `upsertMethodName` key indicating if an existing customer was updated or a new one inserted')
    t.ok(lib.isObject(result.send.upsert), 'The send object returns a `upsert` key for the customer data after it was updated')
    t.equal(result.send.upsert.externalId, externalId, 'externalId of the created customer and updated one are the same')
    t.equal(result.send.upsertMethodName, 'customer_insert', 'A customer insert occured as opposed to a customer update')
    t.equal(result.send.send, true, 'Sending the email succeeded albeit the true is not conclusive about if sending actually worked')
    t.end()
  })
})

tape('Proper sending of customer data values', function (t) {
  let externalId = Date.now()+''
  async.autoInject({
    send: function(cb) {
      clang.send({
        "emailAddress": 'a2@b.nl',
        "birthday": new Date(1977, 6, 3), // Datum type -> 3 jul 1977
        externalId,
        "addressNumberSuffix": "1234567890",
        // customer options
        "type-date": new Date(2017, 6, 3), // Datum type -> 3 jul 2017
        "type-datetime": new Date(2017, 6, 3, 14, 15, 16), // Datum / tijd type -> 3 jul 2017 14:15:16
        "type-time": '13:14', // Tijd type
        "type-number-2": 0.1234, // Getal met 2 decimalen
        "type-number-3": 0.2345, // Getal met 3 decimalen
        "type-numeric": 6, // Numeriek type
        "type-options": 'b', // Keuzelijst
        "type-alphanumeric": '123abc', // Alfanumeriek
      }, {
        lookup: 'externalId',
        create: true
      }, cb)
    },
    get: function(send, cb) {
      clang.request('customer_getById', {customerId: send.upsert.id}, cb)
    },
  }, (err, result) => {
    console.log(result.send)
    console.log(result.get)
    t.notOk(err, 'No error occured')
    t.ok(lib.isObject(result.send), 'The result is a non-empty object')
    t.end()
  })
})
