'use strict'

const soap  = require('soap')
const async = require('async')
const moment = require('moment');
const prompt = require('prompt');
const mock  = require('./mock')
const fields = require('./fields');

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

  request(/*methodName, args(optional), cb(optional)*/) {
    const me = this
    let requestArgs, normalizedArgs, pagingArgs = {}
    let methodName, cb
    let promiseMode

    Array.prototype.slice.call(arguments).forEach(arg => {
      if (typeof arg === 'string')
        methodName = arg
      else if (arg && typeof arg === 'object')
        requestArgs = arg
      else if (typeof arg === 'function')
        cb = arg
    })
    if (!cb) {
      promiseMode = true
      cb = function() {}
    }

    return new Promise((resolve, reject) => {

      const errAway = (error) => {
        if (promiseMode) {
          reject(error)
        }
        setImmediate(cb.bind(null, error))
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
        request: (init, cb) => {
          let fn = me.api[methodName]

          if (!fn) {
            return setImmediate(cb.bind(null, `Undefined method '${methodName}'`))
          }


          if (me.config.normalizeOptionFields) {
            normalizedArgs = me.normalizeInput(methodName, requestArgs)
          } else {
            normalizedArgs = requestArgs
          }

          if (me.config.debug) {
            console.log(`Making SOAP request to ${methodName}...`)
          }

          fn(normalizedArgs, cb)
        },
        output: ['request', (result, cb) => {
          // result is an array with [json result, raw xml response, soapHeader ]
          let [obj, raw, ] = result

          if (me.config.logPayload) {
            console.log('payload outgoing', me.api.lastRequest)
            console.log('payload incoming', raw)
          }
          if (me.config.debug) {
            console.log(`Incoming SOAP response ${JSON.stringify(obj).slice(0,50)}...`)
          }
          //Check for No SOAP Fault, but result code not 0
          if (obj.code != 0) {
            return setImmediate(cb.bind(null, new Error(`No SOAP Fault, but result code not 0: ${JSON.stringify(obj.msg)}`)))
          }
          //Check for No SOAP Fault, but obj.msg = false (probably delete that didn't work out)
          if (obj.msg === false) {
            return setImmediate(cb.bind(null, new Error(`No SOAP Fault, but result msg is false (delete failed?): ${JSON.stringify(obj.msg)}`)))
          }
          if (obj.msg === null) {
            // this occurs for example when doing a customer_getByExternalId with a externalId that is not found
            if (me.config.debug) {
              console.log(`No records found in SOAP response (msg=null)`)
            }
            return setImmediate(cb.bind(null, null, []))
          }
          if (obj.msg === undefined) {
            return setImmediate(cb.bind(null, new Error(`No SOAP Fault, but result msg is undefined (unexpected): ${JSON.stringify(obj.msg)}`)))
          }

          // result is id of resource of which the result is not there yet
          if (typeof obj.msg === 'string' && obj.msg.match(/^\d+$/)) {
            return getResourceSet(me, obj.msg, methodName, normalizedArgs, pagingArgs, cb)
          }

          return setImmediate(cb.bind(null, null, me.normalizeOutput(methodName, obj)))
        }]
      }, (err, result) => {
        // result is an object with the keys of `init` and `request` (as per autoInject)
        if (err) {
          let faultBody = err.root && err.root.Envelope && err.root.Envelope.Body
          if (faultBody) {
            /**
             * err.root.Envelope.Body:
             * {
             *   "Fault": {
             *     "faultcode": "105",
             *     "faultstring": "Size must be between 1 and 50"
             *   }
             * }
             */
            if (
              faultBody.Fault.faultcode == 107 ||
              faultBody.Fault.faultstring.match(/customer already member of/)
            ) {
              console.log(`Incoming SOAP Fault ${JSON.stringify(faultBody)}, reduced to warning`)
              return cb(null, [{msg: true, warning: err.body}])
            }
            console.log(`Incoming SOAP Fault ${JSON.stringify(faultBody)}`)
            return errAway(faultBody)
          }
          return errAway(err)
        }
        if (promiseMode) {
          return resolve(result)
        }
        cb(null, result.output)
      })

    })
  }

  send(customer, options, callback) {
    const me = this

    let customerGetMethodName
    let sendMethodName
    let lookupOption

    if (arguments.length !== 3) {
      callback = customer
      return setImmediate(callback.bind(null, new Error(`send takes 3 arguments: customer, options and callback function`)))
    }
    if (!customer || typeof customer !== 'object' || !Object.keys(customer).length) {
      return setImmediate(callback.bind(null, new Error(`The customer argument must be an non-empty object`)))
    }

    lookupOption = (options.lookup || 'externalId').toLowerCase()

    try {
      // errors may be thrown while transforming
      customer = me.transformFields(customer, options)
    } catch (e) {
      return setImmediate(callback.bind(null, e))
    }

    let customerArgs = {}
    if (lookupOption === 'externalid') {
      customerGetMethodName = 'customer_getByExternalId'
      customerArgs.externalId = customer.externalId
      if (!customerArgs.externalId) {
        return setImmediate(callback.bind(null, new Error(`customer.externalId is required with lookup method '${lookupOption}'`)))
      }
    }
    else if (lookupOption === 'customerid') {
      customerGetMethodName = 'customer_getById'
      customerArgs.customerId = customer.id || customer.customerId
      if (!customerArgs.customerId) {
        return setImmediate(callback.bind(null, new Error(`customer.id/customerId is required with lookup method '${lookupOption}'`)))
      }
    }
    else if (lookupOption === 'email' || lookupOption === 'emailaddress') {
      customerGetMethodName = 'customer_getByEmailAddress'
      customerArgs.emailAddress = customer.email || customer.emailAddress
      if (!customerArgs.emailAddress) {
        return setImmediate(callback.bind(null, new Error(`customer.email/emailAddress is required with lookup method '${lookupOption}'`)))
      }
    }
    else {
      return setImmediate(callback.bind(null, new Error(`lookup option '${lookupOption}' is not supported`)))
    }

    if (options.context && !options.contextId) {
      return setImmediate(callback.bind(null, new Error(`When a send context is used, a contextId is mandatory`)))
    }

    // only support send to group for now. Needs a backing Clang campaign listening to the group
    if (options.context && ['group', 'email'].indexOf(options.context) === -1 ) {
      return setImmediate(callback.bind(null, new Error(`send to context '${options.context}' is not supported`)))
    }

    async.autoInject({
      get: (cb) => {
        me.request(customerGetMethodName, customerArgs, (err, result) => {
          let isArray = result instanceof Array
          let numRecords

          if (
            err &&
            err.Fault &&
            (
              err.Fault.faultcode == 213 ||
              err.Fault.faultstring.match(/not found/i)
            )
          ) {
            // No record found with customer_getById
            numRecords = 0
          }
          else if (err) {
            return cb(err)
          }
          else {
            numRecords = isArray ? result.length : result ? 1 : 0
          }

          if (numRecords === 0 && !options.create) {
            return cb(new Error(`Customer not found and create is not allowed`))
          }
          if (numRecords > 1) {
            return cb(new Error(`Multiple customers returned after get`))
          }
          cb(null, isArray ? result[0] : result)
        })
      },
      upsertMethodName: (get, cb) => {
        setImmediate(cb.bind(null, null, get ? 'customer_update' : 'customer_insert'))
      },
      upsert: (get, upsertMethodName, cb) => {
        if (get) {
          // The found record should be included in the supplied data
          // to make sure that record is updated.
          customer.id = get.id
        }

        me.request(upsertMethodName, {customer}, cb)
      },
      send: ['upsert', (upsert, cb) => {
        let args = {}

        if (options.context === 'group') {
          sendMethodName = 'group_addMember'
          args.group = {
            id: options.contextId
          }
          args.customer = {
            id: upsert.id
          }
        }
        else if (options.context === 'email') {
          sendMethodName = 'email_sendToCustomer'
          args = Object.assign({}, customer, {
            emailId: options.contextId,
            customerId: upsert.id
          })
        }
        if (sendMethodName) {
          return me.request(sendMethodName, args, cb)
        }

        console.warn('No context found, just synced customer', JSON.stringify(customerArgs), ' with Clang')
        setImmediate(cb)
      }]
    }, callback)
      // result to final callback is an object with the keys of
      // `get`, `upsertMethodName`, `upsert` and `send` (as per autoInject)
  }

  transformFields(customer, options) {
    const me = this

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
        transformedCustomer[fieldMapTo] = me.safeValue('customer', fieldMapTo, value)
      }
      else if (typeof fieldMapTo === 'object') {
        // take the fieldName and values configuration of this fieldMap to transform the key and value
        transformedCustomer[fieldMapTo.fieldName] = me.safeValue('customer', fieldMapTo.fieldName, fieldMapTo.values[value] || value)
      }
      else {
        // set the value on the same key
        transformedCustomer[key] = me.safeValue('customer', key, value)
      }
    })
    return transformedCustomer
  }

  safeValue(resourceName, fieldName, value) {
    if (isObject(value) || value instanceof Array) {
      value = JSON.stringify(value)
    }

    let fieldDefinition = fields[resourceName] && fields[resourceName][fieldName]

    if (!fieldDefinition) {
      if (value instanceof Date) {
        return moment(value).format('YYYY-MM-DD HH:mm:ss')
      }
      return value
    }

    if (fieldDefinition.type === 'date') {
      return moment(value).format('YYYY-MM-DD')
    }
    if (fieldDefinition.type === 'datetime') {
      return moment(value).format('YYYY-MM-DD HH:mm:ss')
    }
    if (fieldDefinition.enum && fieldDefinition.enum.indexOf(value) === -1) {
      throw new Error(`Value of '${value}' is not one of the allowed values (${fieldDefinition.enum.join(',')}) of ${resourceName}.${fieldName}`)
    }
    if (fieldDefinition.maxlength && (value.length > fieldDefinition.maxlength)) {
      throw new Error(`Length of '${value}' (${value.length}) is longer than the allowed maxlength (${fieldDefinition.maxlength}) of ${resourceName}.${fieldName}`)
    }

    return  value
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
      return result.msg
    }
    if (outputDefinition.outputType === 'object') {
      return result.msg
    }
    return result.msg[outputDefinition.outputType]
  }

  deleteAll(resourceName, cb) {
    const me = this

    async.autoInject({
      getAll: (cb) => {
        me.request(`${resourceName}_getAll`, cb)
      },
      prompt: (getAll, cb) => {
        prompt.start()
        prompt.get({
          name: 'answer',
          message: `Sure you want to delete all ${getAll.length} ${resourceName}s`,
          validator: /y[es]*|n[o]?/i,
          warning: 'Must respond [Y]es or [N]o',
          required: false,
          default: 'No'
        }, cb)
      },
      deleteAll: (getAll, prompt, cb) => {
        console.log('prompt', prompt)
        if (!prompt.answer.match(/y[es]*/i)) {
          return setImmediate(cb)
        }
        console.log(`Deleting ${getAll.length} ${resourceName}s...`)
        async.map(getAll, (item, cb) => {
          if (resourceName === 'customer') {
            me.request(`${resourceName}_delete`, {[resourceName]: item}, cb)
          } else {
            me.request(`${resourceName}_delete`, {[resourceName+'Id']: item.id}, cb)
          }
        }, cb)
      }
    }, cb)
  }
}

//Private stuff starts here
const isObject = o => (!!o) && (o.constructor === Object)

const getResourceSet = (instance, resourceId, methodName, normalizedArgs, pagingArgs, cb) => {
  const setMethods = {
    CUSTOMER_SET: 'customerSet_getCustomers',
    MAILING_SET : 'mailingSet_getMailings',
    OPEN_SET    : 'openSet_getOpens',
    CLICK_SET   : 'clickSet_getClicks',
    BOUNCE_SET  : 'bounceSet_getBounces'
  }

  let config = instance.config
  let api = instance.api
  let uuid = normalizedArgs.uuid

  async.autoInject({
    poll: (cb) => {
      async.doWhilst(cb => {
        if (config.debug) {
          console.log(`Checking state of resource: ${resourceId} for ${methodName}`)
        }
        api.resource_getById({ uuid, resourceId }, (err, result) => {
          if (err) return cb(err)
          if (config.debug) {
            console.log(`Resource ${result.msg.type} = ${result.msg.status} (id: ${result.msg.id}, records: ${result.msg.size})`)
          }
          if (result && result.msg.status === 'ERROR') {
            return cb(new Error(`Error getting resource ${resourceId} (probably incorrect x_getByObject request parameters)`))
          }
          if (result && result.msg.status === 'CLOSED') {
            return cb(new Error(`Resource ${resourceId} was closed unexpectedly`))
          }
          cb(null, result)
        })
      }, (result) => (result.msg.status === 'PROCESSING'),  cb)
    },
    /**
     * @param {object} poll - result of READY resource set
     * {
     *   code: 0,
     *   msg: {
     *     id    : "147082",
     *     type  : "CUSTOMER_SET",
     *     status: "READY",
     *     size  : "1"
     *   }
     * }
     */
    getData: (poll, cb) => {
      if (config.debug) {
        console.log(`Getting records from resourceId: ${resourceId} using ${setMethods[poll.msg.type]}`)
      }

      if (!(poll.msg.size > 0)) {
        if (config.debug) {
          console.log(`No records found in SOAP response`)
        }
        // poll.msg.size = 0, no need to go fetch result set
        return setImmediate(cb.bind(null, null, []))
      }

      let setMethodName = setMethods[poll.msg.type]
      api[setMethodName]({
        uuid, resourceId,
        offset    : pagingArgs.offset,
        size      : pagingArgs.size
      }, (err, result) => {
        if (config.logPayload) {
          console.log('payload outgoing', api.lastRequest)
          // console.log('payload incoming', raw)
        }
        if (err) {
          if (config.debug) {
            console.error('Error in getting resource set')
          }
          return cb(err)
        }
        cb(null, instance.normalizeOutput(setMethodName, result))
      })
    },
    freeResource: (getData, cb) => {
      if (config.debug) {
        console.log(`Free resource with resourceId: ${resourceId}`)
      }
      api.resource_free({ uuid, resourceId }, cb)
    }
  }, (err, result) => {
    if (config.logPayload) {
      console.log('payload outgoing', api.lastRequest)
      // console.log('payload incoming', raw)
    }
    cb(err, result.getData)
  })
}

module.exports = Clang
