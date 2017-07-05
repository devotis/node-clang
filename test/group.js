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

tape('getting a group', function (t) {
  async.autoInject({
    getById: function(cb) {
      clang.request('group_getById', { groupId: 60}, cb)
    },
    getByObject: function(getById, cb) {
      clang.request('group_getByObject', { group: {name: 'test'}}, cb)
    }
  }, (err, result) => {
    console.log(result.getById)
    console.log(result.getByObject)
    t.notOk(err, 'No error occured')
    // t.ok(result.getById)
    // t.ok(lib.isObject(result.getById), 'The getById result is a non-empty object')
    t.end()
  })
})
