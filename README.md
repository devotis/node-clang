node-clang
==========

Anyone using <a href="http://www.createaclang.com/">Clang</a>'s SOAP API? Here's something that will make your life easier. A NodeJS application that wraps Clang's SOAP API and exposes the methods that callback with JSON data. You don't need to bother with the extra resource callbacks that some methods like customer_getByObject require. Internally these resources are polled and the final dataset is returned in the callback.

I had a ton of fun building this. NodeJS rocks!

##Example

    var clang = require('clang');

    clang.uuid('your_clang_api_key_aka_uuid');
    clang.init(function(err, api) {
        if (err) {
            console.log('err', err.message);
            return;
        }
        
        //using the newly created API
        api.objects.group.getAll({}, function(err, rows) {
            console.log(err, rows);
        });
        
        api.objects.customer.getByObject({
            customer: {
                firstname: 'lookmeup'
            }
        }, function(err, rows) {
            console.log(err, rows);
        });
    });

Another great use case for this is a REST API out of the available methods exposed by this API. Check here https://github.com/devotis/node-clang-rest

##WSDL
This is the underlying WSDL document that is used by clang.init()

https://secure.myclang.com/app/api/soap/public/index.php?wsdl
