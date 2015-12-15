var _     = require('lodash');
var soap  = require('soap');
var async = require('async');

function Clang(config) {
  var me = this;

  if (!(me instanceof Clang)) {
    return new Clang(config);
  }
  me.config = _.clone(config || {});
  me.config.normalizeOptionFields = me.config.normalizeOptionFields == undefined ? true : me.config.normalizeOptionFields

  me.wsdl = 'https://secure.myclang.com/app/api/soap/public/index.php?wsdl';

  if (!me.config.version) {
    //By default this version is locked, because I now it works
    me.wsdl += '&version=1.23';
  } else if (me.config.version !== '*') {
    //Get a specific version by supplying the version number
    me.wsdl += '&version=' + me.config.version;
  }
  me.api    = null;
}

Clang.prototype.request = function(methodName, args, callback) {
  var me = this;
  var requestArgs, pagingArgs = {};

  if (arguments.length === 2) {
    callback = args;
    requestArgs = {
      uuid: me.config.uuid
    };
  } else if (arguments.length === 3) {
    requestArgs = _.assign({
      uuid: me.config.uuid
    }, args || {});
  } else {
    throw new Error('request takes 3 arguments: methodName, args (object) and callback function');
  }

  if (!requestArgs.uuid) {
    return setImmediate(function() {
      callback(new Error('uuid missing. Provide it with the 2nd arguments object or with client instantiation. Hint: `var clang = new Clang({uuid: \'12345678-...\'})`'));
    });
  }

  pagingArgs.offset = requestArgs._offset || 0;
  pagingArgs.size   = requestArgs._size   || 50;
  delete requestArgs._offset;
  delete requestArgs._size;

  async.waterfall([
    function async_init(callback){
      if (me.api) {
        console.log('SOAP client already created');
        return setImmediate(callback);
      }
      if (me.config.debug) {
        console.log('Creating SOAP client');
      }

      soap.createClient(me.wsdl, function(err, result) {
        if (err) {
          return callback(err);
        }

        if (me.config.debug) {
          console.log('SOAP client created');
        }
        me.api = result;
        me.description = result.describe();

        callback();
      });
    },
    function async_request(callback){
      var fn = me.api[methodName];

      if (!fn) {
        return setImmediate(function() {
          callback(new Error('Undefined method `' + methodName + '`'));
        });
      }

      var args;

      if (me.config.normalizeOptionFields) {
        args = normalizeInput(me.config, me.description, methodName, requestArgs);
      } else {
        args = requestArgs;
      }

      fn(args, buildCallback(requestArgs.uuid, me.config, me.api, pagingArgs, callback));
    }
  ], function(err, result) {
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
        return callback(err.root.Envelope.Body);
      }
      return callback(err);
    }
    return callback(null, result);
  });
};

//Private stuff starts here
var setMethods = {
  CUSTOMER_SET: 'customerSet_getCustomers',
  MAILING_SET : 'mailingSet_getMailings',
  OPEN_SET    : 'openSet_getOpens',
  CLICK_SET   : 'clickSet_getClicks',
  BOUNCE_SET  : 'bounceSet_getBounces'
};

/**
 * Move arguments to an options object
 */
var normalizeInput = function(config, description, clangMethodName, args) {

  var inputDefinition = description.clangAPI.clangPort[clangMethodName].input;

  //To understand this code better, check how the entire interface definition
  // looks like in JSON created by createClient in wsdl 1.18.json

  var optionsIdentifier, optionIdentifier;

  var clangObjectName;
  if (clangMethodName.match('^email_sendTo')) {
    optionsIdentifier = 'manualOptions';
    optionIdentifier  = 'Option';
    clangObjectName   = 'email';
  } else if (clangMethodName.match('^customer')) {
    optionsIdentifier = 'options';
    optionIdentifier  = 'CustomerOption';
    clangObjectName   = 'customer';
  } else {
    return args;
  }

  var normalizedArgs = _.clone(args);

  var moveOptions = function (object, inputDefinition) {
    Object.keys(object).forEach(function(key) {
      if (typeof inputDefinition[key] !== 'string') {
        if (!object[optionsIdentifier]) {
          object[optionsIdentifier] = {};
          object[optionsIdentifier][optionIdentifier] = [];
        }
        object[optionsIdentifier][optionIdentifier].push({
          name : key,
          value: object[key]
        });
        delete object[key];
      }
    });
  };

  if (args[clangObjectName] && Object.prototype.toString.call(args[clangObjectName]) === '[object Object]') {
    moveOptions(normalizedArgs[clangObjectName], inputDefinition[clangObjectName]);
  } else {
    moveOptions(normalizedArgs, inputDefinition);
  }

  return normalizedArgs;
};

/**
 * Normalizes response to an array of objects
 */
var normalizeResponse = function(config, result) {
  if (result.msg === true) {
    if (config.debug) {
      console.log('SOAP success');
    }
    return [{msg: true}];
  }

  var msgKeys = Object.keys(result.msg);
  if (msgKeys.length === 0) {
    if (config.debug) {
      console.log('No records found in SOAP response');
    }
    return [];
  }
  if (msgKeys.length === 1 && result.msg[msgKeys[0]] instanceof Array) {
    if (config.debug) {
      console.log('SOAP msg array returned'); //{ code: 0, msg: { Group: [Object] } }
    }
    return result.msg[msgKeys[0]];
  }
  if (result.msg) { // 1 record from x_getById or x_create
    if (config.debug) {
      console.log('SOAP msg object returned');
    }
    return [result.msg];
  }
};

/**
 * Factory for clang method callback builder. It deals with:
 * - getting a resource id status
 * - getting the data set when the resource is READY
 * - normalizing the response
 * @param config   - a reference to the configuration passed when instantiating Clang
 * @param api      - a reference to a previously created soap client with Clang's wsdl and node-soap
 * @param callback - the method for handling the final data set
 */
var buildCallback = function (uuid, config, api, pagingArgs, callback) {

  return function apiCallback(err, result) {
    if (config.logRequests) {
      console.log(api.lastRequest);
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
    var resourceId;
    if (err) {
      console.log('SOAP error arrived', err.body);
    }

    //Check for actual SOAP Fault generated by callback in soap/lib/client line 152
    if (err) {
      if (err.body &&
          err.body.match(/<faultcode>107<\/faultcode>/) &&
          err.body.match(/customer already member of/) )
        return callback(null, [{msg: true, warning: err.body}]);
      return callback(err);
    }
    //Check for No SOAP Fault, but result code not 0
    if (result.code != 0) {
      return callback(new Error('No SOAP Fault, but result code not 0: ' + JSON.stringify(result.msg)));
    }
    //Check for No SOAP Fault, but result.msg = false (probably delete that didn't work out)
    if (result.msg === false) {
      return callback(new Error('No SOAP Fault, but result msg is false (delete failed?): ' + JSON.stringify(result.msg)));
    }
    //When resource is READY fetch the data using the resourceMethod
    if (result.msg.status === 'ERROR') {
      return callback(new Error('Error getting resource (probably incorrect x_getByObject request parameters)'));
    }
    //Check for result that should be fetched using new SOAP call
    if (typeof result.msg === 'string' || //first attempt trying if resource is READY
      result.msg.status === 'PROCESSING'  //next attempts trying if resource is READY
    ) {
      resourceId   = typeof result.msg === 'string' ? result.msg : result.msg.id;

      if (config.debug) {
        console.log('Invoking SOAP method to see if resourceId is READY: ' + resourceId);
      }
      api.resource_getById({
        uuid      : uuid,
        resourceId: resourceId
      }, apiCallback);
      return;
    }
    if (result.msg.status === 'READY') {
      resourceId = result.msg.id;

      if (config.debug) {
        console.log('Resource of resourceId: ' + resourceId + ' is READY ('+result.msg.size+ ' records)');
      }
      if (result.msg.size > 0) {
        async.series([
          function(callback){
            if (config.debug) {
              console.log('Getting data from resource with resourceId: ' + resourceId + ' using ' + setMethods[result.msg.type]);
            }
            api[setMethods[result.msg.type]]({
              uuid      : uuid,
              resourceId: resourceId,
              offset    : pagingArgs.offset,
              size      : pagingArgs.size
            }, function (err, result) {
              if (config.logRequests) {
                console.log(api.lastRequest);
              }
              if (err) {
                if (config.debug) {
                  console.error('Error in getting resource set');
                }
                return callback(err);
              }
              callback(null, normalizeResponse(config, result));
            });
          },
          function(callback){
            if (config.debug) {
              console.log('Free resource with resourceId: ' + resourceId);
            }
            api.resource_free({
              uuid      : uuid,
              resourceId: resourceId
            }, callback);
          }
        ],
        function(err, results) {
          if (config.logRequests) {
            console.log(api.lastRequest);
          }
          callback(err, results[0]);
        });
        return;
      }

      if (config.debug) {
        console.log('No records found in SOAP response');
      }
      return callback(null, []);
    }
    if (result.msg) {
      return callback(null, normalizeResponse(config, result));
    }

    return callback(new Error('Unexpected and unhandled response: ' + JSON.stringify(result.msg)));
  };
};

module.exports = Clang;