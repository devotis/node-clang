clang
=====

Node application that creates an API for Clang that wraps its SOAP API.

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
