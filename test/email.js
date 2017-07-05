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

tape('creating an email', function (t) {
  async.autoInject({
    deleteAll: clang.deleteAll.bind(clang, 'email'),
    empty: function(deleteAll, cb) {
      clang.request('email_insert', {
        email: {
        }
      }, err => {
        t.ok(err, 'Can\'t create an email from an empty object')
        t.equal(lib.faultcode(err), 105, 'and returns a Undefined mailtype ()')
        cb()
      })
    },
    create: function(empty, cb) {
      clang.request('email_create', cb)
    },
    insertThatFails: ['create', function(create, cb) {
      let email = Object.assign({}, create)

      clang.request('email_insert', {email}, err => {
        t.ok(err, 'Can\'t create an email without a content name')
        t.equal(lib.faultcode(err), 751, 'and returns a invalid content name []')
        cb()
      })
    }],
    insert2: ['create', function(create, cb) {
      let email = Object.assign({}, create, {
        name: 'test-name',
        htmlContent: 'test-htmlContent'
      })
      clang.request('email_insert', {email}, cb)
    }]
  }, (err, result) => {
    t.notOk(err, 'No error occured')
    t.ok(result.create)
    t.ok(lib.isObject(result.create), 'The create result is a non-empty object')
    t.ok(lib.isObject(result.insert2), 'The insert result is a non-empty object')
    t.end()
  })
})
