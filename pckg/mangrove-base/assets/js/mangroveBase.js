var mangroveBase = angular.module("mangroveBase", ['OmniBinder']);

mangroveBase
	.service('dataPersist',
	[
		'obBinder', 'obBinderTypes', 'mgAppStatus', 'restBinder', '$http',
		function(obBinder, obBinderTypes, mgAppStatus, restBinder, $http)
		{
			var IsNumeric = function (input) {
				return (input - 0) == input && (input+'').replace(/^\s+|\s+$/g, "").length > 0;
			};

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
					$http.get('/'+resource)
						.success(
						function (data) {
							angular.forEach(data, function(item) {
								scope[model].push(item);
							});

							mgAppStatus.ready(500);

							scope.binder = obBinder(
								scope,
								model,
								restBinder,
								{
									key: 'id',
									query: resource,
									type: obBinderTypes.COLLECTION
								}
							);

							if ( typeof callback.load !== 'undefined' ) {
								callback.load();
							}
						}
					);
				};

				scope.load();
			}
		}
	]
);

mangroveBase
	.service('restBinder',
	[
		'DirtyPersist', 'obBinderTypes', '$parse', '$http',
		function (DirtyPersist, obBinderTypes, $parse, $http)
		{
			function getIndexOfItem (list, id, key) {
				var itemIndex = 0;

				angular.forEach(list, function (item, i) {
					if (itemIndex) return itemIndex;
					if (item[key] === id) itemIndex = i;
					return null;
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

			function updateCallback(binder, update) {
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
					function(update){ addCallback(binder, update); }
				);

				binder.persist.on('remove', binder.query,
					function(update){ removeCallback(binder, update); }
				);

				binder.persist.on('update', binder.query,
					function(update){ updateCallback(binder, update); }
				);
			};

			function postAdditions(binder, change, getter) {
				for (var j = change.index; j < change.addedCount + change.index; j++) {
					binder.ignoreNProtocolChanges++;

					elem = getter(binder.scope)[j];

					// Post to server, assign the id we get back
					$http.post('/'+binder.query, elem)
						.success(
						function(data) {
							elem.id = data;
						}
					);
				}
			}

			function postRemoves(binder, change) {
				for (var k = 0; k < change.removed.length; k++) {
					binder.ignoreNProtocolChanges++;

					var object = change.removed[k];

					$http.delete('/'+binder.query+'/'+object.id);
				}
			}

			function postChanges(binder, change) {
				binder.ignoreNProtocolChanges++;

				$http.post('/'+binder.query, JSON.stringify(change.changed));
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
	.service( 'DirtyPersist',
		[
		'$q', '$timeout', '$http', 'mgAppStatus',
		function ($q, $timeout, $http, mgAppStatus)
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
					}(delay)
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

				$http.get('/hook/updates')
					.success(
					function (updates) {
						// If we find nothing right now, slow down a little
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
				$http.post('/hook/subscription', {resource:res});
			}
		}
	]
);

mangroveBase
	.service( 'mgAppSession',
		[
		'$http', 'mgAppStatus', 'DirtyPersist',
		function( $http, mgAppStatus, DirtyPersist ) {
			function Session() {
				var session = this;

				this.init = function(component) {
					$http.defaults.transformRequest.push(
						function (data, headersGetter) {
							var test = data;
						}
					)
				};
			}

			return new Session();
		}
	]
);

mangroveBase
	.service('mgAppStatus',
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
