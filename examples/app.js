var express = require('express');
var soap    = require('soap');    //https://github.com/milewise/node-soap

var url = 'https://secure.myclang.com/app/api/soap/public/index.php?wsdl&version=1.18';
//var url = "http://www.webservicex.com/CurrencyConvertor.asmx?wsdl";

//Define helper functions
function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

console.log('Fetching WSDL and preparing SOAP client...');
soap.createClient(url, function(err, client) {
	console.log('SOAP client created');
	var clang = client.describe();

	clang.objects={};

	var resourceMethods=[];

    var methodsForCRUD = ['getByObject', 'getAll', 'insert', 'update', 'delete'];

    for (var key in clang.clangAPI.clangPort) {
    	var methodNameParts = key.split('_');

    	if (methodsForCRUD.indexOf(methodNameParts[1]) === -1)
    		continue; //go to next iteration

    	//It's just these objects that offer full CRUD: customer, group, email, sms
    	var method = clang.clangAPI.clangPort[key];
    	if (!clang.objects[methodNameParts[0]]) {
    		clang.objects[methodNameParts[0]]={
    			methods: {}
    		};
    	}

        //some method do not output records directly, instead they return a reference to a resource set
        //this bit within if captures these methods and adds a property to indicate
        //that the output has to be fetched through a resourceSet
    	if (method.output.code == "xsd:integer" &&
    		method.output.msg  == "xsd:long" && 
    		[
    			'customer_getTotalNumberOfCustomers',
    			'magentoEmail_insert',
    			'magento_executeAbandonedCart'
    		].indexOf(key) === -1) { //the output of these methods is not referring to a resource but have similar output as the ones that do

    		method.useResource = true;
    	    resourceMatch = methodNameParts[1].match(/get(\w+)Set/);

    	    if (resourceMatch) {
    	    	method.resourceMethod = resourceMatch[1].toLowerCase()+'Set_get'+resourceMatch[1]+'s';
    	    } else if (methodNameParts[1] == 'getMembers') {
    	    	method.resourceMethod = 'customerSet_getCustomers';
    	    } else {
    	    	method.resourceMethod = methodNameParts[0]+'Set_get'+capitalize(methodNameParts[0])+'s';
    	    }
    	    method.resourceMethod = method.resourceMethod.replace(/ys$/, 'ies');

    	    if (resourceMethods.indexOf(method.resourceMethod) === -1) {
    	    	resourceMethods.push(method.resourceMethod);
    	    	//resourceMethods.push(clang.clangAPI.clangPort[method.resourceMethod]) ;
            }
    	}

    	//add the method to the methods object of the object
    	clang.objects[methodNameParts[0]].methods[methodNameParts[1]] = method;
    }

    //remove objects that do not have full CRUD support
    for (var key in clang.objects) {
    	if (Object.keys(clang.objects[key].methods).length !== methodsForCRUD.length)
    		delete clang.objects[key];
    }

    console.log('SOAP methods analyzed. Avaliable for CRUD:', Object.keys(clang.objects).join(', '));


    //INIT WEB
	var app = express();
    app.all('/api/clang/:object?/:id?', function(req, res){
    	var uuid = req.headers.uuid;
    	if (!uuid || !uuid.match(/^([0-9]-)?[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i)) { //Clang (probably) uses a version 4 UUIDs scheme relying only on random numbers.
    		res.status(401); //The client tried to operate on a protected resource without providing the proper authentication credentials.
    		res.send('401 - uuid missing or invalid');
    		return; 
		}
        if (Object.keys(clang.objects).indexOf(req.params.object) === -1) {
        	res.status(404);
    		res.send('404 - resource actually not available');
    		return; 
        }

        var clangObjectName = req.params.object;
        var clangMethodName;

        switch(req.query.method || req.method) { //HTTP VERB override through query paramater (override through http header would be better)
        	case 'GET'   : clangMethodName = (Object.keys(req.query).length===0 ? 'getAll' : 'getByObject'); break;
        	case 'POST'  : clangMethodName = 'create';      break;
        	case 'PUT'   : clangMethodName = 'update';      break;
        	case 'DELETE': clangMethodName = 'delete';      break;
        	default      : res.status(405); return; //HTTP verb used to access this page is not allowed
        }

        var clangFullMethodName = clangObjectName + '_' + clangMethodName;

        delete req.query.method; //HTTP VERB overriding query paramater not used anymore
        var args = {
            uuid: uuid
        };
        args[clangObjectName] = req.query

        var roundTrips=0, maxAttempts=10;

        var clientCallback = function(err, result, clangObjectName, clangMethodName, resourceId, resourceMethod) {
            roundTrips++;
            if (roundTrips > maxAttempts) {
                throw new Error('Exceeded the maximum number of attempts');
            }
            console.log('SOAP response arrived');
            //Check for actual SOAP Fault generated by callback in soap/lib/client line 152
            if (err) {
                res.status(500);
                res.send(err.message);
                return;
            }
            //Check for No SOAP Fault, but result code not 0
            if (result.code != 0) {
                res.status(500);
                res.send('No SOAP Fault, but result code not 0: ' + JSON.stringify(result.msg));
                return;
            }
            //Check for result that should be fetched using new SOAP call
            if (clang.objects[clangObjectName] && clang.objects[clangObjectName].methods[clangMethodName].useResource || //first attempt trying if resource is READY
                clangObjectName === 'resource' && clangMethodName === 'getById' && result.msg.status === 'PROCESSING'    //next attempts trying if resource is READY
            ) {

                resourceId     = resourceId     || result.msg ;//    = (typeof result.msg === "object" ? result.msg.id : result.msg );
                resourceMethod = resourceMethod || clang.objects[clangObjectName].methods[clangMethodName].resourceMethod;
                var resourceArgs   = {
                    uuid: uuid,
                    resourceId: resourceId
                };

                console.log('Invoking SOAP method to see if resourceId is READY: ' + resourceId);
                client['resource_getById'](resourceArgs, function(err, result) {
                    /* result looks like: {
                          "code": 0,
                          "msg": {
                            "id": "147082",
                            "type": "CUSTOMER_SET",
                            "status": "READY",
                            "size": "1"
                          }
                        }
                    */
                    clientCallback(err, result, 'resource', 'getById', resourceId, resourceMethod)
                });
                console.log('Awaiting SOAP response (for resourceId)...');

                return;
            }
            //When resource is READY fetch the data using the resourceMethod
            if (clangObjectName === 'resource' && clangMethodName === 'getById' && result.msg.status === 'READY') {
                console.log('Resource is READY ('+result.msg.size+ ' records)');
                if (result.msg.size > 0) {
                    var resourceArgs   = {
                        uuid: uuid,
                        resourceId: resourceId,
                        offset: 0,
                        size: 50
                    };
                    client[resourceMethod](resourceArgs, function(err, result) {
                        clientCallback(err, result, 'dummy', 'dummy')
                    });
                    console.log('Awaiting SOAP response (for resource records)...');
                } else {
                    res.set({
                        'content-type': 'application/json'
                    }).send([]);
                    console.log('No records found');
                }

                return;
            }

            //we have 0 or more results. Normalize it to just the array to output
            var msgKeys = Object.keys(result.msg);
            if (msgKeys.length === 0) {
                res.set({
                    'content-type': 'application/json'
                }).send([]);
                console.log('No records found');
                return;
            }
            if (msgKeys.length === 1 && result.msg[msgKeys[0]] instanceof Array) {
                res.set({
                    'content-type': 'application/json'
                }).send(
                    result.msg[msgKeys[0]]
                );
                console.log('msg array returned');
                return;
            }
          

            //console.log('zzzz', JSON.stringify(clang.clangAPI.clangPort[clangMethod], null, 2));

            res.send(result);
            console.log('SOAP call results to browser');
            //console.log(client.lastRequest);
            roundTrips--;
        };

        console.log('Invoking SOAP method: ' + clangFullMethodName + '('+JSON.stringify(args)+')');
		client[clangFullMethodName](args, function(err, result) {
            clientCallback(err, result, clangObjectName, clangMethodName)
        });
        console.log('Awaiting SOAP response...');
	});

	app.listen(3000);
	console.log('Listening on port 3000');
});
