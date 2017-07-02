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

tape('creating an email', function (t) {
  async.autoInject({
    empty: function(cb) {
      clang.request('email_insert', {
        email: {
        }
      }, err => {
        t.ok(err, 'Can\'t create an email from an empty object')
        t.equal(lib.faultcode(err), 105, 'and returns a Undefined mailtype ()')
        cb()
      })
    },
    create: function(cb) {
      clang.request('email_create', cb)
    },
    insert: ['create', function(create, cb) {
      clang.request('email_insert', {email: create}, err => {
        t.ok(err, 'Can\'t create an email without a content name')
        t.equal(lib.faultcode(err), 751, 'and returns a invalid content name []')
        cb()
      })
    }]
  }, (err, result) => {
    console.log('result.create', result.create)
    console.log('result.insert', result.insert)
    t.notOk(err, 'No error occured')
    t.ok(result.create)
    t.ok(lib.isObject(result.create), 'The create result is a non-empty object')
    t.end()
  })
})
