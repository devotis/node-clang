'use strict'
process.env.NODE_ENV = 'test'

const config = require('config')
const tape = require('tape')
const async = require('async')
const Clang = require('../')
let clang = new Clang({
  version: '*',
  uuid: config.uuid,
  logPayload: false,
  debug: false,
  mock: !config.uuid
})

const lib = require('./lib');

tape('creating a customer', function (t) {
  async.autoInject({
    withoutCustomerObject: function(cb) {
      clang.request('customer_insert', {emailAddress: 'a1@b.nl'}, cb)
    },
    withCustomerObject: function(cb) {
      clang.request('customer_insert', {customer: {emailAddress: 'a2@b.nl'}}, cb)
    }
  }, (err, result) => {
    t.notOk(err, 'No error occured')
    t.ok(lib.isObject(result.withCustomerObject), 'The result is a non-empty object')
    t.ok(lib.isObject(result.withoutCustomerObject), 'The result is again a non-empty object')
    t.notOk(result.withoutCustomerObject.emailAddress, 'Creation of record with object and immediate key-values leaves the emailAddress should be empty')
    t.equal(result.withCustomerObject.emailAddress, 'a2@b.nl', 'Creation of record with nested customer object is the way to go and the emailAddress should the same as the value inside the customer object')
    t.end()
  })
})

tape('updating a customer', function (t) {
  async.autoInject({
    create: function(cb) {
      clang.request('customer_insert', {customer: {emailAddress: 'a1@b.nl'}}, cb)
    },
    update: ['create', function(create, cb) {
      let customer = Object.assign({}, create, {emailAddress: 'a1-changed@b.nl'})
      clang.request('customer_update', {customer}, cb)
    }],
    withoutCustomerObject: ['update', function(update, cb) {
      let customer = Object.assign({}, update, {emailAddress: 'a1-changed-but-no-effect@b.nl'})
      clang.request('customer_update', customer/* note the missing curly braces */, (err, result) => {
        t.equal(lib.faultcode(err), 213, 'Customer can\'t be found when updating with a non-nested customer object')
        t.notOk(result, 'And then result should be undefined')
        cb()
      })
    }]
  }, (err, result) => {
    t.notOk(err, 'No error occured')
    t.ok(lib.isObject(result.create), 'The create result is a non-empty object')
    t.ok(lib.isObject(result.update), 'The update result is again a non-empty object')
    t.equal(result.create.emailAddress, 'a1@b.nl', 'created with the correct emailAddress')
    t.equal(result.update.emailAddress, 'a1-changed@b.nl', 'updated with the new emailAddress')
    t.end()
  })
})

tape('Looking up customers', function (t) {
  async.autoInject({
    deleteAll: clang.deleteAll.bind(clang, 'customer'),
    testAnswer: function(deleteAll, cb) {
      if (!deleteAll.prompt.answer.match(/y[es]*/i)) {
        return setImmediate(cb.bind(null, new Error('Prompt was answered with No, stopping test because it will fail')))
      }
      setImmediate(cb)
    },
    create1: function(testAnswer, cb) {
      clang.request('customer_insert', {customer: {firstname: '1', lastname: 'test', externalId: '1', emailAddress: 'a1@b.nl'}}, cb)
    },
    create2: function(testAnswer, cb) {
      clang.request('customer_insert', {customer: {firstname: '2', lastname: 'test', externalId: '2', emailAddress: 'a2@b.nl'}}, cb)
    },
    create3: function(testAnswer, cb) {
      clang.request('customer_insert', {customer: {firstname: '3', lastname: 'test', externalId: '3', emailAddress: 'a3@b.nl'}}, cb)
    },
    getById: function(create1, create2, create3, cb) {
      clang.request('customer_getById', {customerId: create2.id}, cb)
    },
    getByObject: function(create1, create2, create3, cb) {
      clang.request('customer_getByObject', {customer: {lastname: 'test'}}, cb)
    }
  }, (err, result) => {
    t.notOk(err, 'No error occured')
    t.ok(lib.isObject(result.getById), 'The create result is a non-empty object')
    t.equal(result.getById.firstname, '2', 'The correct record was found')
    t.ok(lib.arrayWithObjects(result.getByObject, 3), 'all 3 records are found')
    t.end()
  })
})
