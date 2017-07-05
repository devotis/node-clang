'use strict'

const fixtures = require('./fixtures')

module.exports = (clang) => {
  clang.request = (methodName, data, cb) => {
    let result = (fixtures.find(item => item.methodName === methodName) || {
      result: null
    }).result

    if (methodName === 'customer_insert') {
      result = Object.assign({}, result, data.customer)
    }
    if (methodName === 'customer_update') {
      result = Object.assign({}, result, data.customer)
    }
    if (methodName === 'customer_getById') {
      result = Object.assign({}, result, {id: data.customerId})
    }

    setImmediate(cb.bind(null, null, result))
  }
}
