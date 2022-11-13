locApp = angular.module('angLocApp', []);

locApp.controller('HomeController', async ($scope, $http) => {
	let URL_SENSORS = document.location.origin + "/sensors";
	let URL_DATA = document.location.origin + "/data";
	let REGISTER_SENSOR = document.location.origin + "/sensors";
	let WATERING_PLANTS = document.location.origin + "/water";

	// Validate if the user is loged
	await validateSession();
	var token = await isLogged();

	$scope.isLogged = true;
	$scope.loading = true;
	$scope.sinceDate = null;
	$scope.toDate = null;
	$scope.sensors = [];
	$scope.data = [];

	$scope.identificatorToAdd = '';


	var socket = io({
		extraHeaders: {
			token: token
		}
	});

	socket.on("event", (...args) => {
		console.debug("event", args);
		$scope.showToast();
	});

	$scope.getSensors = function () {
		$scope.loading = true;
		// First get all sensors
		$http.get(URL_SENSORS + '?token=' + encodeURIComponent(token)).then(function (response) {
			if (!response.data) $scope.sensors = [];
			$scope.sensors = response.data;
			$scope.loadSensorsData();
		});
	}

	$scope.getSensors();

	$scope.loadSensorsData = function () {
		// $scope.loading = true;
		$scope.data = [];
		let url = URL_DATA + '?token=' + encodeURIComponent(token);
		console.debug("URL", url, $scope.sensors);
		// Iter for each sensor
		let urlSensorData = url + "&identificators=" + encodeURIComponent(JSON.stringify($scope.sensors.map((item) => item.identificator)));
		if ($scope.sinceDate && $scope.toDate) urlSensorData += "&sinceDate=" + $scope.sinceDate.toISOString() + "&toDate=" + $scope.toDate.toISOString();
		$http.get(urlSensorData).then((response) => {
			$scope.loading = false;
			// If there is no data continue next sensor
			if (!response.data) return;
			for (const sensor of $scope.sensors) {
				let currentSensorData = {
					identificator: sensor.identificator,
					data: response.data.filter((item) => item.identificator == sensor.identificator)
				}
				// Add the data to the sensor dict
				$scope.data.push(currentSensorData);
				$scope.loadCharts(currentSensorData)
			}
			console.debug("Collected data", $scope.data, $scope.loading);
		})
	}

	$scope.loadCharts = function (sensorData) {
		setTimeout(function () {
			$scope.loadMoistureTemperatureChart(sensorData);
			// $scope.loadTemperatureChart(sensorData);
		}, 500);
	}

	$scope.loadMoistureTemperatureChart = function (sensorData) {
		let chartId = "moisture-line-" + sensorData.identificator;
		// const labels = Utils.months({count: 7});
		let data = {
			labels: sensorData.data.map((item) => item.created),
			datasets: [{
				label: 'Moisture',
				data: sensorData.data.map((item) => item.moisture),
				fill: true,
				borderColor: 'rgb(0, 0, 255)',
				tension: 0.1
			}, {
				label: 'Temperature',
				data: sensorData.data.map((item) => item.temperature),
				fill: true,
				borderColor: 'rgb(255, 0, 0)',
				tension: 0.1
			}]
		}
		const ctx = document.getElementById(chartId).getContext('2d');
		const myChart = new Chart(ctx, {
			type: 'line',
			data: data,
			options: {
				responsive: true,
				interaction: {
					intersect: false,
				},
				scales: {
					x: {
						display: true,
						type: 'time',
						title: {
							display: true
						},
						time: {
							displayFormats: {
								quarter: 'MMM YYYY',
								hour: 'dd/MM/yyyy HH:mm'
							}
						}
					},
					y: {
						display: true,
						title: {
							display: true,
						}
					}
				}
			},
		});
	}

	$scope.loadTemperatureChart = function (sensorData) {
		let chartId = "temperature-line-" + sensorData.identificator;
		// const labels = Utils.months({count: 7});
		let data = {
			labels: sensorData.data.map((item) => item.created),
			datasets: [{
				label: 'Moisture',
				data: sensorData.data.map((item) => item.temperature),
				fill: true,
				borderColor: 'rgb(0, 0, 255)',
				tension: 0.1
			}]
		}
		const ctx = document.getElementById(chartId).getContext('2d');
		const myChart = new Chart(ctx, {
			type: 'line',
			data: data,
			options: {
				responsive: true,
				interaction: {
					intersect: false,
				},
				scales: {
					x: {
						display: true,
						type: 'time',
						title: {
							display: true
						},
						time: {
							displayFormats: {
								quarter: 'MMM YYYY',
								hour: 'dd/MM/yyyy HH:mm'
							}
						}
					},
					y: {
						display: true,
						title: {
							display: true,
							text: 'Temperature'
						}
					}
				}
			},
		});
	}


	$scope.sendSocketEvent = () => {
		socket.emit('event', "Example");
		console.log("Logggg")
	}

	$scope.logout = () => {
		console.debug("Logout")
		socket.disconnect();
		removeSession();
		document.location = document.location.origin;
	}


	$scope.registerNewSensor = async () => {
		try {
			let url = REGISTER_SENSOR + '?token=' + encodeURIComponent(token);
			let identificatorToAdd = document.getElementById('identificator').value
			let answer = await $http.post(url, { 'identificator': identificatorToAdd });
			var myModalEl = document.getElementById('registerDeviceModal')
			var modal = bootstrap.Modal.getInstance(myModalEl)
			modal.hide()
			$scope.getSensors();
		} catch (error) {
			console.error("registerNewSensor error", error);
			if (error.status == 400 && error.data && error.data.message) {
				showError("register-sensor-error", error.data.message);
			} else {
				showError("register-sensor-error", "Error saving data, try again later");
			}
		}
	}


	$scope.wateringPlants = async (identificator) => {
		try {
			let url = WATERING_PLANTS + '?token=' + encodeURIComponent(token);
			await $http.post(url, { 'identificator': identificator });
		} catch (error) {
			console.error("registerNewSensor error", error);
			if (error.status == 400 && error.data && error.data.message) {
				showError("register-sensor-error", error.data.message);
			} else {
				showError("register-sensor-error", "Error saving data, try again later");
			}
		}
	}


	$scope.showToast = function () {
		while ($scope.myToast) {
			setTimeout(()=>{console.debug("Waiting toast")}, 500);
		}
		var myToastEl = document.getElementById('liveToast');
		$scope.myToast = bootstrap.Toast.getOrCreateInstance(myToastEl);

		$scope.myToast.show()
		setTimeout(() => {
			$scope.myToast.hide();
			$scope.myToast = null;
		}, 4000);

	}

});

