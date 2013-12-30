/*
 * Copyright (c) 2013 Christiaan Westerbeek <chris@devotis.nl>
 * MIT Licensed
 */
var soap = require('soap');

function Clang() {
    //add to Clang.prototype the easier functions like customer.get that wrap the customer_getByObject etc

    var url = 'https://secure.myclang.com/app/api/soap/public/index.php?wsdl&version=1.18';
    //var url = "http://www.webservicex.com/CurrencyConvertor.asmx?wsdl";

    //Define helper functions
    function capitalize(string) {
      return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
    }

    console.log('Fetching WSDL and preparing SOAP client...');


    soap.createClient(url, this.callback);
};

Clang.prototype.callback = function(err, client) {
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
};