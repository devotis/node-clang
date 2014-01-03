clang
=====

Anyone using <a href="http://www.createaclang.com/">Clang</a>'s SOAP API? Here's something that will make your life easier. A NodeJS application that wraps Clang's SOAP API and exposes the methods that callback with JSON data. You don't need to bother with the extra resource callbacks that some methods like customer_getByObject require. Internally these resources are polled and the final dataset is returned in the callback.

I had tons of fun building this. NodeJS rocks!

Example

    var clang = require('clang');
    clang.init('your_uuid', '1.18', function(err, api) {
        if (err) {
            console.log('err', err.message);
            return;
        }
        
        api.objects.group.getAll({/*params maybe here*/}, function(err, rows) { // <-- using the newly created API
            console.log(err, rows);
        });
    });

Another great use case for this is a REST API out of the available methods exposed by this API. Check here https://github.com/devotis/node-clang-rest
