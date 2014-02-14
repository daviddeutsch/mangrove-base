var mangroveBase = angular.module("mangroveBase", ['restangular', 'OmniBinder']);

mangroveBase
	.config(
		[
		'RestangularProvider',
		function (RestangularProvider)
		{
			RestangularProvider.setResponseExtractor(function(response) {
				var newResponse = response;
				if ( angular.isArray(response) ) {
					angular.forEach(newResponse, function(value, key) {
						newResponse[key].originalElement = angular.copy(value);
					});
				} else {
					newResponse.originalElement = angular.copy(response);
				}

				return newResponse;
			});
		}
		]
	);

mangroveBase
	.service('dataPersist',
	[
	'obBinder', 'obBinderTypes', 'restangularBinder', 'Restangular', 'mgAppStatus',
	function(obBinder, obBinderTypes, restangularBinder, Restangular, mgAppStatus)
	{
		var IsNumeric = function (input) {
			return (input - 0) == input && (input+'').replace(/^\s+|\s+$/g, "").length > 0;
		};

		function requestFromPath(resource) {
			var res = resource.split('/' );

			if ( res.length == 1 ) {
				return Restangular.all(res[0]).getList();
			} else if ( res.length == 2 && !IsNumeric(res[1]) ) {
				return Restangular.one(res[0]+'/'+res[1]).get();
			}  else if ( res.length == 2 ) {
				return Restangular.one(res[0], res[1]).get();
			} else if ( res.length == 3 ) {
				return Restangular.one(res[0], res[1]).all(res[2]).getList();
			} else if ( res.length == 4 ) {
				return Restangular.one(res[0]+'/'+res[1], res[2]).all(res[3]).getList();
			}

			return Restangular;
		}

		this.getList = function (scope, model, resource, callback) {
			if ( typeof callback == 'undefined' ) {
				callback = {};
			}

			mgAppStatus.loading();

			scope[model] = [];

			scope.add = function(item) {
				scope[model].push(item);

				Platform.performMicrotaskCheckpoint();

				if ( typeof callback.add !== 'undefined' ) {
					callback.add();
				}
			};

			scope.remove = function(id) {
				var item;
				for ( var i = 0; i < scope[model].length; i++ ) {
					item = scope[model][i];
					if (item.id == id) {
						scope[model].splice(i, 1);

						Platform.performMicrotaskCheckpoint();

						if ( typeof callback.remove !== 'undefined' ) {
							callback.remove();
						}
					}
				}
			};

			scope.load = function() {
				requestFromPath(resource)
					.then(function(items) {
						angular.forEach(items, function(item) {
							scope[model].push(item.originalElement);
						});

						mgAppStatus.ready(500);
					})
					.then(function(){
						scope.binder = obBinder(
							scope,
							model,
							restangularBinder,
							{
								key: 'id',
								query: resource,
								type: obBinderTypes.COLLECTION
							}
						);
					})
					.then(function(){
						if ( typeof callback.load !== 'undefined' ) {
							callback.load();
						}
					});
			};

			scope.load();
		}
	}
	]
);

mangroveBase
	.service('restangularBinder',
	[
	'DirtyPersist', 'obBinderTypes', '$parse', 'Restangular',
	function (DirtyPersist, obBinderTypes, $parse, Restangular)
	{
		function getIndexOfItem (list, id, key) {
			var itemIndex = 0;

			angular.forEach(list, function (item, i) {
				if (itemIndex) return itemIndex;
				if (item[key] === id) itemIndex = i;
			});

			return itemIndex;
		}

		function addCallback(binder, update) {
			var index = getIndexOfItem(binder.scope[binder.model], update.id, binder.key);

			index = typeof index === 'number' ? index : binder.scope[binder.model].length;

			binder.onProtocolChange.call(binder, [{
				addedCount: 1,
				added: [update],
				index: index,
				removed: []
			}]);
		}

		function removeCallback(binder, update) {
			var index = getIndexOfItem(binder.scope[binder.model], update.id, binder.key);

			if (typeof index !== 'number') return;

			var change = {
				removed: [update],
				addedCount: 0,
				index: index
			};

			binder.onProtocolChange.call(binder, [change]);
		}

		function updateCallback(update) {
			var index, removed;

			index = getIndexOfItem(binder.scope[binder.model], update.id, binder.key);

			index = typeof index === 'number' ? index : binder.scope[binder.model].length - 1;

			removed = angular.copy(binder.scope[binder.model][index]);

			binder.onProtocolChange.call(binder, [{
				index: index,
				addedCount: 1,
				removed: [removed],
				added: [update]
			}]);
		}

		this.subscribe = function (binder) {
			binder.index = [];

			binder.persist = DirtyPersist;
			binder.persist.subscribe(binder.query);

			if ( binder.type !== obBinderTypes.COLLECTION ) return;

			binder.persist.on('add', binder.query,
				function(){
					addCallback(binder, update);
				}
			);

			binder.persist.on('remove', binder.query,
				function(){
					removeCallback(binder, update);
				}
			);

			binder.persist.on('update', binder.query,
				function(){
					updateCallback(binder, update);
				}
			);
		};

		function postAdditions(binder, change, getter) {
			for (var j = change.index; j < change.addedCount + change.index; j++) {
				binder.ignoreNProtocolChanges++;

				var elem = getter(binder.scope)[j];

				// Post to server, assign the id we get back
				Restangular.all(binder.query).post(elem)
					.then(
					function(reply) {
						elem.id = reply;
					}
				);
			}
		}

		function postRemoves(binder, change) {
			for (var k = 0; k < change.removed.length; k++) {
				binder.ignoreNProtocolChanges++;

				var object = change.removed[k];

				Restangular.one(binder.query, object.id).remove();
			}
		}

		function postChanges(binder, change) {
			binder.ignoreNProtocolChanges++;

			Restangular.one(binder.query, change.index)
				.customPOST(JSON.stringify(change.changed));
		}

		this.processChanges = function (binder, delta) {
			var change,
				getter = $parse(binder.model);

			for ( var i = 0; i < delta.changes.length; i++ ) {
				change = delta.changes[i];

				if ( change.addedCount ) postAdditions(binder, change, getter);

				if ( change.removed.length ) postRemoves(binder, change);

				if ( !$.isEmptyObject(change.changed) ) postChanges(binder, change);
			}
		};
	}
	]
);

mangroveBase
	.service('DirtyPersist',
	[
	'$q', '$timeout', 'Restangular', 'mgAppStatus',
	function ($q, $timeout, Restangular, mgAppStatus)
	{
		var callbacks = [];

		var delay = 1000;

		var keepalive;

		// Poll the server every interval if we're listening for something
		var tick = function () {
			mgAppStatus.ready(500);

			query().then(
				function () {
					Platform.performMicrotaskCheckpoint();

					keepalive = $timeout(tick, delay);
				}
			);
		};

		// When polling, trigger callbacks
		var query = function () {
			var deferred = $q.defer();

			if ( callbacks.length ) {
				deferred.promise
					.then(updateCheck)
					.then(function(){
						mgAppStatus.ready(500);
					})
			}

			deferred.resolve();

			return deferred.promise;
		};

		var updateCheck = function () {
			mgAppStatus.loading();

			Restangular.all('hook/updates').getList().then(
				function (reply) {
					// If we find nothing right now, slow down a little
					if ( reply.length < 1 ) {
						delay = 2000;

						return;
					}

					var updates = [];

					angular.forEach(reply, function(update) {
						updates.push(update.originalElement);
					});

					if ( updates.length < 1 ) {
						delay = 2000;

						return;
					}

					// Regular speed now
					delay = 1000;

					angular.forEach(updates, function(update) {
						angular.forEach(callbacks, function(callback) {
							if (
								( update.operation == callback.operation )
									&& ( update.type == callback.query )
								) {
								callback.callback(update.object);
							}
						});
					});
				}
			);
		};

		this.cycleStart = function() {
			tick();
		};

		this.cycleStop = function() {
			$timeout.cancel(keepalive);
		};

		this.on = function (operation, query, callback) {
			callbacks.push(
				{
					operation: operation,
					query:     query,
					callback:  callback
				}
			);
		};

		this.subscribe = function (res) {
			Restangular.all('hook/subscription').post({resource:res});
		}
	}
	]
);

mangroveBase
	.service('appStatus',
	[
	'$rootScope',
	function ( $rootScope )
	{
		var timer;

		this.loading = function () {
			clearTimeout( timer );

			$rootScope.status = 1;
		};

		this.ready = function ( delay ) {
			function ready() {
				$rootScope.status = 0;
			}

			clearTimeout( timer );

			delay = delay == null ? 500 : false;

			if ( delay ) {
				timer = setTimeout( ready, delay );
			} else {
				ready();
			}
		};
	}
	]
);
