'use strict'
process.env.NODE_ENV = 'test'

const tape = require('tape')
const Clang = require('../')

tape('Platform configuration', (t) => {
  let clangSecure = new Clang({version: '1.23'})
  let clangLogin = new Clang({version: '1.23', platform: 'login'})

  t.plan(2)
  t.equal(clangSecure.wsdl, 'https://secure.myclang.com/app/api/soap/public/index.php?wsdl&version=1.23')
  t.equal(clangLogin.wsdl, 'https://login.myclang.com/app/api/soap/public/index.php?wsdl&version=1.23')

  t.end()
})
