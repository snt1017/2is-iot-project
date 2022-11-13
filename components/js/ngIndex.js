locApp = angular.module('angLocApp', []);

locApp.controller('IndexController', async ($scope, $http) => {

	let LOGIN_URL = document.location.origin + "/login";

	$scope.credentials = {
		username: '',
		password: ''
	}

	$scope.login = async () => {
		try {
			let answer = await $http.post(LOGIN_URL, $scope.credentials);
			console.debug(answer);
			storeSession(answer.data.token);
			document.location = document.location.origin + '/home';
		} catch (error) {
			console.error("Login error", error);
			showError("login-error", "Username or password are incorrect");
		}
	}

});

