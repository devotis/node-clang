'use strict'
process.env.NODE_ENV = 'test'

const tape = require('tape')
const Clang = require('../')
let clang = new Clang({version: '*'})

tape('Fields', (t) => {
  let data = {
    a: 1,
    email: 'a@b.nl',
    gender: 'M',
    name: 'me'
  }
  let options = {
    fieldMap: {
      name: 'firstname'
    }
  }

  let actual = clang.transformFields(data, options)
  let expected = {
    a: 1,
    emailAddress: 'a@b.nl',
    gender: 'MAN',
    firstname: 'me'
  }

  t.deepEqual(actual, expected, 'Transform well')

  data = {
    a: 'a@b.nl'
  }

  actual = clang.transformFields(data)

  t.deepEqual(actual, data, 'Transform well again')
  t.notEqual(actual, data, 'Into a NEW object')

  t.end()
})
