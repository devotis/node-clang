var clang = require('clang');


clang.init('7e5b4df2-7a91-4af0-9119-1fc2d6fdc8a2', '1.18', function(err, api) {
	if (err) {
		console.log('err', err.message);	
	}



	/*api.objects.group.getAll({}, function(err, rows) {

		console.log(err, rows);

	});*/
	/*api.objects.customer.getByObject({
		customer: {
			emailAddress: 'c.westerbeek@gmail.com'
		}
	}, function(err, rows) {

		console.log('errhere', err, rows);

	});*/
	/*api.objects.customer.insert({
		customer: {
			firstname: 'Christiaan',
			emailAddress: 'c.westerbeek@gmail.com'
		}
	}, function(err, rows) {

		console.log(err, rows);

	});*/

	/*api.objects.customer.update({
		customer: {
			id: 39514,
			firstname: 'Christiaan333',
			emailAddress: 'c.westerbeek@gmail.com'
		}
	}, function(err, rows) {

		console.log(err, rows);

	});*/

	api.objects.customer.delete({
		customer: {
			id: 39514,
			firstname: 'Christiaan333',
			emailAddress: 'c.westerbeek@gmail.com'
		}
	}, function(err, rows) {

		console.log(err, rows);

	});
});


/*Interesting
turns modules into RESTFul web-services: https://npmjs.org/package/webservice
wrap webservice into functions https://npmjs.org/package/imjs

patterns for modules: http://darrenderidder.github.io/talks/ModulePatterns/#/9
*/