'use strict'
process.env.NODE_ENV = 'test'

const config = require('config')
const tape = require('tape')
const async = require('async')
const Clang = require('../')
let clang = new Clang({version: '*', uuid: config.get('uuid'), logPayload: false})

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
//
// tape('customer_getByXxx', (t) => {
//   let isCalled = function() {isCalled = true}
//
//   async.parallel([
//     // (cb) => {
//     //   clang.request('customer_getById', {id: 0})
//     //   .then(isCalled)
//     //   .catch(err => {
//     //     t.ok(err, 'customer_getById with non existing id should callback with an error')
//     //     t.ok(err.Fault, 'Which is a SOAP Fault')
//     //     t.equal(err.Fault.faultcode, '213', 'With faultcode 213')
//     //     cb()
//     //   })
//     // },
//     (cb) => {
//       clang.request('customer_getByExternalId')
//       .then(isCalled)
//       .catch(err => {
//         t.ok(err, 'customer_getById with non existing id should callback with an error')
//         t.ok(err.Fault, 'Which is a SOAP Fault')
//         t.equal(err.Fault.faultcode, '213', 'With faultcode 213')
//         cb()
//       })
//     },
//     // (cb) => {
//     //   clang.request('customer_getByEmailAddress', {emailAddress: 'c-a-n-t-p-o-s-s-s-s-s-i-b-ly@exi.st'})
//     //   .then(isCalled)
//     //   .catch(err => {
//     //     t.ok(err, 'customer_getById with non existing id should callback with an error')
//     //     t.ok(err.Fault, 'Which is a SOAP Fault')
//     //     t.equal(err.Fault.faultcode, '213', 'With faultcode 213')
//     //     cb()
//     //   })
//     // }
//   ], () => {
//     t.notEqual(isCalled, true, 'None of the promises should have resolved')
//     t.end()
//   })
// })
