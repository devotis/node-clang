node-clang
==========

Anyone using <a href="http://www.createaclang.com/">Clang</a>'s SOAP api? Here's something that will make your life easier. A Node.js api that wraps Clang's SOAP api. You don't need to bother with the extra resource callbacks that some methods like customer_getByObject require. Internally these resources are polled and the final dataset is returned in the callback.

I had a ton of fun building this. Node.js rocks!

##Install

    npm install clang

##Example

    var Clang = require("./lib/clang");

    var clang = new Clang({uuid: '12345678-1234-1234-1234-123456781234'});

    clang.request('group_getMembers', {
      groupId: 2
    }, function(err, result) {
      console.log(arguments);
    });


##WSDL
This is the underlying WSDL document that is used

https://secure.myclang.com/app/api/soap/public/index.php?wsdl
