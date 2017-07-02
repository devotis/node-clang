'use strict'

const soap  = require('soap')
const async = require('async')
const mock  = require('./mock')

class Clang {
  constructor(config) {
    const me = this

    me.config = Object.assign({}, config)

    me.wsdl = 'https://secure.myclang.com/app/api/soap/public/index.php?wsdl'

    if (!me.config.version) {
      //By default this version is locked, because I now it works
      me.wsdl += '&version=1.23'
    } else if (me.config.version !== '*') {
      //Get a specific version by supplying the version number
      me.wsdl += '&version=' + me.config.version
    }
    me.api = null

    if (me.config.mock) {
      mock(me)
    }
  }

  request(/*methodName, args(optional), callback(optional)*/) {
    const me = this
    let requestArgs, pagingArgs = {}
    let methodName, callback
    let promiseMode

    Array.prototype.slice.call(arguments).forEach(arg => {
      if (typeof arg === 'string')
        methodName = arg
      else if (arg && typeof arg === 'object')
        requestArgs = arg
      else if (typeof arg === 'function')
        callback = arg
    })
    if (!callback) {
      promiseMode = true
      callback = function() {}
    }

    return new Promise((resolve, reject) => {

      function errAway(error) {
        if (promiseMode) {
          reject(error)
        }
        setImmediate(callback.bind(null, error))
      }

      requestArgs = requestArgs || {}
      requestArgs.uuid = requestArgs.uuid || me.config.uuid

      if (!methodName) {
        return errAway(`methodName argument (string) missing`)
      }
      if (!requestArgs.uuid) {
        return errAway(`uuid missing. Provide it with the 2nd arguments object or with client instantiation. Hint: 'let clang = new Clang({uuid: '12345678', ...})'`)
      }

      pagingArgs.offset = requestArgs._offset || 0
      pagingArgs.size   = requestArgs._size   || 50
      delete requestArgs._offset
      delete requestArgs._size

      async.autoInject({
        init: (callback) => {
          if (me.api) {
            if (me.config.debug) {
              console.log(`SOAP client already created`)
            }
            return setImmediate(callback)
          }
          if (me.config.debug) {
            console.log(`Creating SOAP client...`)
          }

          soap.createClient(me.wsdl, (err, result) => {
            if (err) {
              return callback(err)
            }

            if (me.config.debug) {
              console.log(`SOAP client created`)
            }
            me.api = result
            me.description = result.describe()

            callback()
          })
        },
        request: ['init', (init_data, callback) => {
          let fn = me.api[methodName]

          if (!fn) {
            return callback(`Undefined method '${methodName}'`)
          }

          let args

          if (me.config.normalizeOptionFields) {
            args = me.normalizeInput(methodName, requestArgs)
          } else {
            args = requestArgs
          }

          fn(args, buildCallback(requestArgs.uuid, me, methodName, pagingArgs, callback))
        }]
      }, (err, result) => {
        // result is an object with the keys of `init` and `request` (as per autoInject)
        if (err) {
          if (err.root && err.root.Envelope && err.root.Envelope.Body) {
            /**
             * err.root.Envelope.Body:
             * {
             *   "Fault": {
             *     "faultcode": "105",
             *     "faultstring": "Size must be between 1 and 50"
             *   }
             * }
             */
            return errAway(err.root.Envelope.Body)
          }
          return errAway(err)
        }
        if (promiseMode) {
          return resolve(result)
        }
        callback(null, result.request)
      })

    })
  }

  send(customer, options, callback) {
    const me = this

    let customerGetMethodName
    let upsertMethodName
    let sendMethodName

    if (arguments.length !== 3) {
      callback = customer
      return setImmediate(callback.bind(null, new Error(`send takes 3 arguments: customer, options and callback function`)))
    }
    if (!customer || typeof customer !== 'object' || !Object.keys(customer).length) {
      return setImmediate(callback.bind(null, new Error(`The customer argument must be an non-empty object`)))
    }

    options.lookup = options.lookup || 'externalId'

    customer = me.transformFields(customer, options)

    let customerArgs = {}
    if (options.lookup === 'externalId') {
      customerGetMethodName = 'customer_getByExternalId'
      customerArgs.externalId = customer.externalId
      if (!customerArgs.externalId) {
        return setImmediate(callback.bind(null, new Error(`customer.externalId is required with lookup method '${options.lookup}'`)))
      }
    }
    else if (options.lookup === 'customerId') {
      customerGetMethodName = 'customer_getById'
      customerArgs.customerId = customer.id || customer.customerId
      if (!customerArgs.customerId) {
        return setImmediate(callback.bind(null, new Error(`customer.id/customerId is required with lookup method '${options.lookup}'`)))
      }
    }
    else if (options.lookup === 'email') {
      customerGetMethodName = 'customer_getByEmailAddress'
      customerArgs.emailAddress = customer.email || customer.emailAddress
      if (!customerArgs.emailAddress) {
        return setImmediate(callback.bind(null, new Error(`customer.email/emailAddress is required with lookup method '${options.lookup}'`)))
      }
    }
    else {
      return setImmediate(callback.bind(null, new Error(`lookup method '${options.lookup}' is not supported`)))
    }

    if (options.context && !options.contextId) {
      return setImmediate(callback.bind(null, new Error(`When a send context is used, a contextId is mandatory`)))
    }

    // only support send to group for now. Needs a backing Clang campaign listening to the group
    if (options.context && ['group', 'email'].indexOf(options.context) === -1 ) {
      return setImmediate(callback.bind(null, new Error(`send to context '${options.context}' is not supported`)))
    }

    async.autoInject({
      get: (callback) => {
        me.request(customerGetMethodName, customerArgs, (err, result) => {
          if (
            // Geen record gevonden zouden we via customer_getById als volgt weten
            err && err.Fault && (err.Fault.faultcode == 213 || err.Fault.faultstring.match(/not found/i)) ||
            // via customer_getByExternalId als volgt
            result && !result.length
          ) {
            if (!options.create) {
              return callback(new Error(`Customer not found and create is not allowed`))
            }
          }
          else if (err) {
            return callback(err)
          }
          if (result && result.length > 1) {
            return callback(new Error(`Multiple customers returned after get`))
          }
          callback(null, result.length ? result[0] : null)
        })
      },
      upsert: ['get', (record, callback) => {
        if (record) {
          // The found record should be included in the supplied data
          // to make sure that record is updated.
          customer.id = record.id
          upsertMethodName = 'customer_update'
        } else {
          upsertMethodName = 'customer_insert'
        }

        me.request(upsertMethodName, {customer}, callback)
      }],
      send: ['upsert', (record, callback) => {
        let args = {}

        if (options.context === 'group') {
          sendMethodName = 'group_addMember'
          args.group = {
            id: options.contextId
          }
          args.customer = {
            id: record.id
          }
        }
        else if (options.context === 'email') {
          sendMethodName = 'email_sendToCustomer'
          args = Object.assign({}, customer, {
            emailId: options.contextId,
            customerId: record.id
          })
        }
        if (sendMethodName) {
          return me.request(sendMethodName, args, callback)
        }

        console.warn('No context found, just synced customer', JSON.stringify(customerArgs), ' with Clang')
        setImmediate(callback.bind(null, null, record))
      }]
    }, (err, result) => {
      // result is an object with the keys of `get`, `upsert` and `send` (as per autoInject)
      if (err) return callback(err)

      callback(null, result.send)
    })
  }

  transformFields(customer, options) {
    options = options || {}
    options.fieldMap = Object.assign({
      // default field mappings
      particle: 'prefix',
      email: 'emailAddress',
      gender: {
        fieldName: 'gender',
        values: {
          M: 'MAN',
          F: 'WOMAN'
        }
      }
    }, options.fieldMap)

    // create a new object with altered keys and values based on the fieldMap configuration
    let transformedCustomer = {}
    Object.keys(customer).forEach((key) => {
      let value = customer[key]
      let fieldMapTo = options.fieldMap[key]
      if (typeof fieldMapTo === 'string') {
        // set the value on the new key
        transformedCustomer[fieldMapTo] = value
      }
      else if (typeof fieldMapTo === 'object') {
        // take the fieldName and values configuration of this fieldMap to transform the key and value
        transformedCustomer[fieldMapTo.fieldName] = fieldMapTo.values[value] || value
      }
      else {
        // set the value on the same key
        transformedCustomer[key] = value
      }
    })
    return transformedCustomer
  }

  /**
   * Move arguments to an options object
   */
  normalizeInput (clangMethodName, args) {
    const me = this

    let inputDefinition = me.description.clangAPI.clangPort[clangMethodName].input

    //To understand this code better, check how the entire interface definition
    // looks like in JSON created by createClient in wsdl/version-1.24.json

    let optionsIdentifier, optionIdentifier

    let clangObjectName
    if (clangMethodName.match('^email_sendTo')) {
      optionsIdentifier = 'manualOptions'
      optionIdentifier  = 'Option'
      clangObjectName   = 'email'
    } else if (clangMethodName.match('^customer')) {
      optionsIdentifier = 'options'
      optionIdentifier  = 'CustomerOption'
      clangObjectName   = 'customer'
    } else {
      return args
    }

    let normalizedArgs = Object.assign({}, args)

    const moveOptions = (object, inputDefinition) => {
      Object.keys(object).forEach((key) => {
        if (typeof inputDefinition[key] !== 'string') {
          if (!object[optionsIdentifier]) {
            object[optionsIdentifier] = {}
            object[optionsIdentifier][optionIdentifier] = []
          }
          object[optionsIdentifier][optionIdentifier].push({
            name : key,
            value: object[key]
          })
          delete object[key]
        }
      })
    }

    if (args[clangObjectName] && Object.prototype.toString.call(args[clangObjectName]) === '[object Object]') {
      moveOptions(normalizedArgs[clangObjectName], inputDefinition[clangObjectName])
    } else {
      moveOptions(normalizedArgs, inputDefinition)
    }

    return normalizedArgs
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
  normalizeOutput (clangMethodName, result) {
    const me = this
    const outputDefinition = me.description.clangAPI.clangPort[clangMethodName].output

    outputDefinition.outputType = outputDefinition.outputType || (function() {
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
      return result.msg
    }
    if (outputDefinition.outputType === 'object') {
      return result.msg
    }
    return result.msg[outputDefinition.outputType]
  }

}

//Private stuff starts here
const setMethods = {
  CUSTOMER_SET: 'customerSet_getCustomers',
  MAILING_SET : 'mailingSet_getMailings',
  OPEN_SET    : 'openSet_getOpens',
  CLICK_SET   : 'clickSet_getClicks',
  BOUNCE_SET  : 'bounceSet_getBounces'
}


/**
 * Factory for clang method callback builder. It deals with:
 * - getting a resource id status
 * - getting the data set when the resource is READY
 * - normalizing the response
 * @param config   - a reference to the configuration passed when instantiating Clang
 * @param api      - a reference to a previously created soap client with Clang's wsdl and node-soap
 * @param callback - the method for handling the final data set
 */
const buildCallback = (uuid, instance, methodName, pagingArgs, callback) => {
  let config = instance.config
  let api = instance.api

  function apiCallback(err, result, raw) {
    if (config.logPayload) {
      console.log('payload outgoing', api.lastRequest)
      console.log('payload incoming', raw)
    }
    /*
      first result that indicate there's a recource looks like this:  { code: 0, msg: '210577' }
      second result of fetching resource status looks like this result looks like: {
        code: 0,
        msg: {
          id    : "147082",
          type  : "CUSTOMER_SET",
          status: "READY",
          size  : "1"
        }
      }
    */
    let resourceId
    if (err) {
      console.log(`SOAP error arrived ${err.body}`)
    }

    //Check for actual SOAP Fault generated by callback in soap/lib/client line 152
    if (err) {
      if (err.body &&
          err.body.match(/<faultcode>107<\/faultcode>/) &&
          err.body.match(/customer already member of/) )
        return callback(null, [{msg: true, warning: err.body}])
      return callback(err)
    }
    //Check for No SOAP Fault, but result code not 0
    if (result.code != 0) {
      return callback(new Error(`No SOAP Fault, but result code not 0: ${JSON.stringify(result.msg)}`))
    }
    //Check for No SOAP Fault, but result.msg = false (probably delete that didn't work out)
    if (result.msg === false) {
      return callback(new Error(`No SOAP Fault, but result msg is false (delete failed?): ${JSON.stringify(result.msg)}`))
    }
    if (result.msg === null) {
      // this occurs for example when doing a customer_getByExternalId with a externalId that is not found
      if (config.debug) {
        console.log(`No records found in SOAP response (msg=null)`)
      }
      return callback(null, [])
    }
    if (result.msg === undefined) {
      return callback(new Error(`No SOAP Fault, but result msg is undefined (unexpected): ${JSON.stringify(result.msg)}`))
    }
    //When resource is READY fetch the data using the resourceMethod
    if (result.msg.status === 'ERROR') {
      return callback(new Error(`Error getting resource (probably incorrect x_getByObject request parameters)`))
    }
    //Check for result that should be fetched using new SOAP call
    if (typeof result.msg === 'string' || //first attempt trying if resource is READY
      result.msg.status === 'PROCESSING'  //next attempts trying if resource is READY
    ) {
      resourceId   = typeof result.msg === 'string' ? result.msg : result.msg.id

      if (config.debug) {
        console.log(`Invoking SOAP method to see if resourceId is READY: ${resourceId}`)
      }
      api.resource_getById({
        uuid      : uuid,
        resourceId: resourceId
      }, apiCallback)
      return
    }
    if (result.msg.status === 'READY') {
      resourceId = result.msg.id

      if (config.debug) {
        console.log(`Resource of resourceId: ${resourceId} is READY (${result.msg.size} records)`)
      }
      if (result.msg.size > 0) {
        async.series([
          (callback) => {
            if (config.debug) {
              console.log(`Getting data from resource with resourceId: ${resourceId} using ${setMethods[result.msg.type]}`)
            }
            let setMethodName = setMethods[result.msg.type]
            api[setMethodName]({
              uuid      : uuid,
              resourceId: resourceId,
              offset    : pagingArgs.offset,
              size      : pagingArgs.size
            }, (err, result) => {
              if (config.logPayload) {
                console.log('payload outgoing', api.lastRequest)
                console.log('payload incoming', raw)
              }
              if (err) {
                if (config.debug) {
                  console.error('Error in getting resource set')
                }
                return callback(err)
              }
              callback(null, instance.normalizeOutput(setMethodName, result))
            })
          },
          (callback) => {
            if (config.debug) {
              console.log(`Free resource with resourceId: ${resourceId}`)
            }
            api.resource_free({
              uuid      : uuid,
              resourceId: resourceId
            }, callback)
          }
        ], (err, results) => {
          if (config.logPayload) {
            console.log('payload outgoing', api.lastRequest)
            console.log('payload incoming', raw)
          }
          callback(err, results[0])
        })
        return
      }

      if (config.debug) {
        console.log(`No records found in SOAP response`)
      }
      return callback(null, [])
    }
    if (result.msg) {
      return callback(null, instance.normalizeOutput(methodName, result))
    }

    return callback(new Error(`Unexpected and unhandled response: ${JSON.stringify(result.msg)}`))
  }

  return apiCallback
}

module.exports = Clang
