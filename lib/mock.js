'use strict'

const fixtures = require('./fixtures')

const database = {
  customer:[],
  email   :[],
  group   :[]
}

const newId = (resourceName) => {
  const table = database[resourceName]
  if (!table) return 1

  return 1 + table.reduce((acc, item) => Math.max(acc, item.id), 0)
}

module.exports.api = (clang, methodName) => {
  return (normalizedArgs, cb) => {
    const [,resourceName, resourceMethod] = methodName.match(/^(\w+)_(\w+)/)
    const table = database[resourceName]

    let items, index, stripped
    let nestedArgs = normalizedArgs[resourceName]

    if (resourceMethod === 'create') {
      items = Object.assign({}, fixtures['empty_' + resourceName] || fixtures[resourceName])
    }
    if (resourceMethod === 'insert') {
      if (resourceName === 'email') {
        if (!nestedArgs) {
          return setImmediate(cb.bind(null, {Fault: {faultcode: 105}}))
        }
        if (!nestedArgs.type) {
          return setImmediate(cb.bind(null, {Fault: {faultcode: 105}}))
        }
        if (!nestedArgs.name) {
          return setImmediate(cb.bind(null, {Fault: {faultcode: 751}}))
        }
      }
      stripped = Object.assign({}, fixtures[resourceName], nestedArgs, {id: newId(resourceName)})

      table.push(stripped)
      items = table[table.length - 1]
    }
    if (resourceMethod === 'update') {
      items = table.find(item => item.id === (nestedArgs && nestedArgs.id))

      if (items) {
        items = Object.assign({}, items, nestedArgs)
      } else {
        return setImmediate(cb.bind(null, {Fault: {faultcode: 213}}))
      }
    }
    if (resourceMethod === 'delete') {
      index = table.findIndex(item => {
        // fix inconsistency between xxx_delete methods
        if (resourceName === 'customer') {
          return item.id === (nestedArgs && nestedArgs.id)
        }
        return item.id === normalizedArgs[resourceName + 'Id']
      })
      if (index > -1) {
        table.splice(index, 1)
      }

      items = true
    }
    if (resourceMethod === 'getById') {
      items = table.find(item => item.id === normalizedArgs[resourceName + 'Id'])

      items = Object.assign({}, items)
    }
    if (resourceMethod === 'getByEmailAddress') {
      items = table.filter(item => item.id === normalizedArgs['emailAddress'])
    }
    if (resourceMethod === 'getByExternalId') {
      items = table.filter(item => item.id === normalizedArgs['externalId'])
    }
    if (resourceMethod === 'getByObject') {
      items = table.filter(item => !Object.keys(nestedArgs).find(key => nestedArgs[key] != item[key]))
    }
    if (resourceMethod === 'getAll') {
      items = table.filter(item => !!item) // make copy
    }

    const result = {
      code: 0,
      msg: getOutput(
        clang,
        methodName,
        items
      )
    }

    setImmediate(cb.bind(null, null, [result, 'fake-soap-reponse', 'soap-headers']))
  }
}

/**
 * Basically the result is always {code: [int], msg: [object]}
 * Some methods return an immediate object as the msg.
 * For example: group_getById outputs:
 * {
 *   code: 0,
 *   msg: { id: '60', parentId: '0', name: 'test', description: '', ... }
 * }
 *
 * But group_getByObject outputs:
 * {
 *   code: 0,
 *   msg: {
 *     Group: [
 *       { id: '60', parentId: '0', name: 'test', description: ', ...  },
 *       ...
 *     ]
 *   }
 * }
 * And some methods like customer_delete output:
 * {
 *   code: 0,
 *   msg: true
 * }
 */
const getOutput = (clang, clangMethodName, data) => {
  const outputDefinition = clang.description.clangAPI.clangPort[clangMethodName].output

  outputDefinition.outputType = outputDefinition.outputType || (() => {
    let outputKeys, match
    if (typeof outputDefinition.msg === 'string') {// like "xsd:boolean"
      return 'primitive'
    }

    outputKeys = Object.keys(outputDefinition.msg)
      .filter(key=>(
        key !== 'targetNSAlias' &&
        key !== 'targetNamespace'
      ))

    if (outputKeys.length === 1 && (match = outputKeys[0].match(/(.*)\[\]$/))) {
      // Matches Group[]
      return match[1]
    }

    return 'object'
  })()

  if (outputDefinition.outputType === 'primitive') {
    return data
  }
  if (outputDefinition.outputType === 'object') {
    return data
  }
  return {[outputDefinition.outputType]: data}
}
