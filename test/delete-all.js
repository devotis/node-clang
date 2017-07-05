'use strict'
process.env.NODE_ENV = 'test'

const config = require('config')
const tape = require('tape')
const async = require('async')
const Clang = require('../')
console.log(config.uuid)
let clang = new Clang({
  version: '*',
  uuid: config.uuid,
  logPayload: false,
  debug: false,
  mock: !config.uuid
})

const lib = require('./lib');

tape('Delete all customers', function (t) {
  async.autoInject({
    createFirst: function(cb) {
      clang.request('customer_insert', {customer: {emailAddress: 'a1@b.nl'}}, cb)
    },
    createSecond: function(cb) {
      clang.request('customer_insert', {customer: {emailAddress: 'a2@b.nl'}}, cb)
    },
    getAll: ['createFirst', 'createSecond', function(createFirst, createSecond, cb) {
      clang.request('customer_getAll', cb)
    }],
    deleteAll: ['getAll', function(getAll, cb) {
      async.map(getAll, (customer, cb) => {
        clang.request('customer_delete', {customer}, cb)
      }, cb)
    }],
    getAllAgain: ['deleteAll', function(deleteAll, cb) {
      clang.request('customer_getAll', cb)
    }]
  }, (err, result) => {
    t.notOk(err, 'No error occured')
    t.ok(lib.arrayWithObjects(result.getAll, 2, true), 'At least 2 records are retrieved as an array with objects')
    t.ok(result.deleteAll.length >= 2, 'At least 2 records are deleted and acknowledged as an array of objects')
    result.deleteAll.forEach(deleteResult => {
      t.equal(deleteResult, true, '`true` is exactly the result for each deleted record')
    })
    t.equal(result.getAllAgain.length, 0, 'And they are gone again')
    t.end()
  })
})

tape('deleting all emails', function (t) {
  async.autoInject({
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
    getAll: ['insertEmail', function(insertEmail, cb) {
      clang.request('email_getAll', cb)
    }],
    deleteAll: ['getAll', function(getAll, cb) {
      async.map(getAll, (email, cb) => {
        clang.request('email_delete', {emailId: email.id}, cb)
      }, cb)
    }],
    getAllAgain: ['deleteAll', function(deleteAll, cb) {
      clang.request('email_getAll', cb)
    }]
  }, (err, result) => {
    t.notOk(err, 'No error occured')
    t.ok(lib.arrayWithObjects(result.getAll, 1, true), 'At least 1 record is retrieved as an array with objects')
    t.ok(result.deleteAll.length >= 1, 'At least 1 record is deleted and acknowledged as an array of objects')
    result.deleteAll.forEach(deleteResult => {
      t.equal(deleteResult, true, '`true` is exactly the result for each deleted record')
    })
    t.equal(result.getAllAgain.length, 0, 'And they are gone again')
    t.end()
  })
})
