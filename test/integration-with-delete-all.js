'use strict'
process.env.NODE_ENV = 'test'

const config = require('config')
const tape = require('tape')
const async = require('async')
const Clang = require('../')
let clang = new Clang({version: '*', uuid: config.get('uuid'), logPayload: false})

tape('before', function (t) {
  async.autoInject({
    createFirst: function(cb) {
      clang.request('customer_insert', {customer: {emailAddress: 'a1@b.nl'}}, cb)
    },
    createSecond: function(cb) {
      clang.request('customer_insert', {customer: {emailAddress: 'a2@b.nl'}}, cb)
    },
    updateSecond: ['createSecond', function(createSecond, cb) {
      t.equal(createSecond.length, 1, 'created second record')
      t.equal(createSecond[0].emailAddress, 'a2@b.nl', 'with correct emailAddress')
      let customer = Object.assign({}, createSecond[0], {emailAddress: 'a2-changed@b.nl'})
      clang.request('customer_update', {customer}, cb)
    }],
    getAll: ['createFirst', 'updateSecond', function(createFirst, updateSecond, cb) {
      t.equal(createFirst.length, 1, 'created first record')
      t.equal(createFirst[0].emailAddress, 'a1@b.nl', 'with correct emailAddress')
      t.equal(updateSecond.length, 1, 'updated second record')
      t.equal(updateSecond[0].emailAddress, 'a2-changed@b.nl', 'with correct emailAddress')
      clang.request('customer_getAll', cb)
    }],
    deleteAll: ['getAll', function(getAll, cb) {
      async.concat(getAll, (customer, cb) => {
        clang.request('customer_delete', {customer}, cb)
      }, cb)
    }],
    getAllAgain: ['deleteAll', function(deleteAll, cb) {
      clang.request('customer_getAll', cb)
    }]
  }, (err, result) => {
    t.notOk(err, 'No error occured')
    t.ok(result.getAll.length >= 2, 'There are at least the 2 records we created earlier')
    t.ok(result.deleteAll.length >= 2, 'There are at least the 2 records we created earlier')
    result.deleteAll.forEach(deleteResult => {
      t.deepEqual(deleteResult, { msg: true }, '{ msg: true } is exactly the result for each deleted record')
    })
    t.equal(result.getAllAgain.length, 0, 'And they are gone again')
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
