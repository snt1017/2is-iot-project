module.exports = (app, db, mqttClient, socketClient, mongoClient) => {

	const AES_PASSWORD = "Plankton-YS-iot";
	let CryptoJS = require("crypto-js");
	let subscribrTopic = 'miflora/#'
	// let subscribrTopic = 'gg/#'
	let topic = 'miflora/action';
	mongoClient.connect();

	let resetMongoConnection = async () => {
		console.log('Connected successfully to MongoDB server');
		const mongoDB = mongoClient.db("youssef-santiago-iot-project");
		const collection = mongoDB.collection('connections');
		const removeResult = await collection.remove();
		// const collection = mongoDB.collection('collected');
		// const removeResult = await collection.remove({ identificator: "Test" });
		console.log('Removed documents =>', removeResult);
	}

	resetMongoConnection();

	// Socket Conections
	socketClient.on('connection', (socket) => {
		console.log(`a user connected ${socket.id}`);
		// console.log(`User token ${socket.handshake.headers.token}`);
		saveMongoConnection(socket.handshake.headers.token, socket.id);
		socket.on('disconnect', () => {
			console.log('user disconnected');
		});
		socket.on('event', (msg) => {
			console.log('message: ', msg);
		});
	});

	// MQTT Conections
	mqttClient.on('connect', () => {
		console.debug("MQTT Is conected");
		mqttClient.subscribe([subscribrTopic], () => {
			console.log(`Subscribe to topic '${subscribrTopic}'`);
		})
	})

	mqttClient.on('message', (topic, payload) => {
		let data = null;
		try {
			data = JSON.parse(payload.toString());
		} catch (error) {
			console.info("Recived not valid message:", topic, payload.toString());
			return
		}
		let parts = topic.split('/');
		let identificator = parts[parts.length - 1];
		// This is a reserved identificator for call actions to iot devices
		if (identificator == 'action' || identificator == '$announce') return;
		saveMongoData(identificator, data);
		sendNewDataEvent(identificator)
	})


	let sendNewDataEvent = (sensorIdentificator) => {
		var postProcessSQL = async function (err, result) {
			if (err) {
				console.error("Error getting user id by sensor", err);
				return;
			}
			// console.debug(result);
			for (let sensor of result) {
				await sendSocketEvent(sensor.user_id, `{"sensor": "${sensorIdentificator}", "action": "new_data"}`)
			}
		};
		getUserIdBySensor(sensorIdentificator, postProcessSQL);
	}


	let saveMongoData = async (identificator, data) => {
		// await mongoClient.connect();
		console.log('Connected successfully to MongoDB server');
		const mongoDB = mongoClient.db("youssef-santiago-iot-project");
		const collection = mongoDB.collection('collected');
		data.identificator = identificator;
		data.created = new Date();
		const insertResult = await collection.insertOne(data);
		console.log('Inserted documents =>', insertResult);
		// mongoClient.close();
	}


	let saveMongoConnection = async (token, socketId) => {
		let userId = getUserByToken(token);
		if (!userId) return;
		// await mongoClient.connect();
		console.log('Connected successfully to MongoDB server');
		const mongoDB = mongoClient.db("youssef-santiago-iot-project");
		const collection = mongoDB.collection('connections');
		let data = {
			user_id: userId,
			socket_id: socketId,
		}
		const insertResult = await collection.insertOne(data);
		console.log('Inserted documents =>', insertResult);
		// mongoClient.close();
	}


	let getMongoSocketData = async (userId) => {
		// await mongoClient.connect();
		console.log('Connected successfully to MongoDB server');
		const mongoDB = mongoClient.db("youssef-santiago-iot-project");
		const collection = mongoDB.collection('connections');
		let query = { 'user_id': String(userId) };
		let result = null;
		try {
			result = await collection.find(query).toArray();
		} catch (error) {
		}
		// mongoClient.close();
		return result;
	}



	let getMongoData = async (identificators, sinceDate, toDate, callback) => {
		// await mongoClient.connect();
		console.log('Connected successfully to MongoDB server');
		const mongoDB = mongoClient.db("youssef-santiago-iot-project");
		const collection = mongoDB.collection('collected');
		// Example: {identificators: {"$in": ["Santiago"]}, created: {"$gte":ISODate('2022-11-09T00:00:00+01:00'),"$lte":ISODate('2022-11-09T23:59:59+01:00')}}
		let query = { 'identificator': {"$in": identificators} };
		if (sinceDate && toDate) {
			query['created'] = { "$gte": Date(sinceDate), "$lte": Date(toDate) }
		}
		let mysort = { created: 1 };
		try {
			const result = await collection.find(query).sort(mysort).toArray();
			callback(null, result);
		} catch (error) {
			callback(error, null);
		}
		// mongoClient.close();
	}


	let sendSocketEvent = async (userId, message) => {
		let socketIds = await getMongoSocketData(userId);
		// console.debug(socketIds);
		for (let socket of socketIds) {
			socketClient.to(socket.socket_id).emit("event", message);
		}
	}

	let returnResponse = (res, code, data) => {
		res.status(code);
		if (typeof data !== 'object') data = { 'message': data };
		res.json(data)
	}

	let getUserByToken = (token) => {
		if (!token) return null;
		try {
			const bytes = CryptoJS.AES.decrypt(token, AES_PASSWORD);
			const originalText = bytes.toString(CryptoJS.enc.Utf8);
			console.debug("User id", originalText);
			// TODO Validate if the user is correct
			if (originalText) return originalText.replace('plankton_', '');
		} catch (error) { }
		return null;
	}

	let getSensorsByUserId = (userId, postProcessSQL) => {
		// SQL
		let sql = `SELECT id, identificator from sensors where user_id='${userId}';`;
		db.query(sql, postProcessSQL);
	}

	let getUserIdBySensor = (identificator, postProcessSQL) => {
		// SQL
		let sql = `SELECT user_id from sensors where identificator='${identificator}';`;
		db.query(sql, postProcessSQL);
	}

	app.get('/', (req, res) => {
		// send the main (and unique) page
		res.setHeader('Content-Type', 'text/html');
		res.sendFile(__dirname + '/views' + '/ngIndex.html');
	});

	app.get('/ngIndex.js', (req, res) => {
		// send the angular app
		res.setHeader('Content-Type', 'application/javascript');
		res.sendFile(__dirname + '/js' + '/ngIndex.js');
	});

	app.get('/home', (req, res) => {
		// send the main (and unique) page
		res.setHeader('Content-Type', 'text/html');
		res.sendFile(__dirname + '/views' + '/ngHome.html');
	});

	app.get('/ngHome.js', (req, res) => {
		// send the angular app
		res.setHeader('Content-Type', 'application/javascript');
		res.sendFile(__dirname + '/js' + '/ngHome.js');
	});


	app.post('/login', function (req, res) {
		let username = (req.body.username);
		let password = (req.body.password);
		let sha256Password = CryptoJS.SHA256(password);
		let sql = 'SELECT id FROM users WHERE username=? and password=?;';
		let values = [username, sha256Password.toString()];
		let postProcess = function (err, result) {
			if (err || result.length == 0) {
				returnResponse(res, 400, 'Not valid credentials');
			} else {
				var data = result[0];
				var token = CryptoJS.AES.encrypt('plankton_' + data.id, AES_PASSWORD).toString()
				console.debug("Generated token", token);
				res.json({
					'token': token
				});
			}
		};
		let result = db.query(sql, values, postProcess);
	});


	app.get('/sensors', (req, res) => {
		// Get token
		let token = req.query.token;
		// Validate if the token exists
		if (!token) return returnResponse(res, 401, 'You are not allowed to perform that action');
		console.debug("gived token", token);
		let userId = getUserByToken(token);
		// Validate if the token returned correct user id
		if (!userId) return returnResponse(res, 401, 'You are not allowed to perform that action');
		// response contains a json array with all tuples
		let postProcessSQL = function (err, result) {
			if (err) throw err;
			return returnResponse(res, 200, result);
		};
		// Get and return all sensors by user
		getSensorsByUserId(userId, postProcessSQL);
	});


	app.post('/sensors', function (req, res) {
		// Get token
		let token = req.query.token;
		// Validate if the token exists
		if (!token) return returnResponse(res, 401, 'You are not allowed to perform that action');
		console.debug("gived token", token);
		let userId = getUserByToken(token);
		// Validate if the token returned correct user id
		if (!userId) return returnResponse(res, 401, 'You are not allowed to perform that action');
		let identificator = (req.body.identificator);
		if (!identificator) return returnResponse(res, 400, 'You must send a valid idetificator');
		// On save identificator
		let onSaveIdentificator = function (err, result) {
			if (err) throw err;
			return returnResponse(res, 200, { 'id': result.insertId, 'identificator': identificator })
		}
		// This method validate if the sensor is not already registered to that user and if is not yet, save it
		let onGetUserSensors = function (err, result) {
			if (err) throw err;
			var sameIdentificator = result.filter((item) => item.identificator == identificator);
			if (sameIdentificator.length > 0) return returnResponse(res, 400, "You already have a sensor registered with that identificator");
			var query = `INSERT INTO sensors(identificator, user_id) VALUES('${identificator}', ${userId})`;
			db.query(query, onSaveIdentificator);
		}
		// Get all sensors by user id
		getSensorsByUserId(userId, onGetUserSensors);
	});


	app.get('/data', (req, res) => {
		// Get token and sensor identificator
		let token = req.query.token;
		// Validate if the token exists
		if (!token) return returnResponse(res, 401, 'You are not allowed to perform that action');
		console.debug("gived token", token);
		let userId = getUserByToken(token);
		// Validate if the token returned correct user id
		if (!userId) return returnResponse(res, 401, 'You are not allowed to perform that action');
		// Get identificator
		let identificators = req.query.identificators;
		// Validate if the identificator exists
		if (!identificators) return returnResponse(res, 400, 'You must send the identificators');
		// Validate if they are list
		try {
			identificators = JSON.parse(identificators);
		} catch (error) {
			return returnResponse(res, 400, 'Identificators must be a list');
		}
		// Get identificator
		let sinceDate = req.query.sinceDate;
		let toDate = req.query.toDate;
		// response contains a json array with all tuples
		let postProcess = function (err, result) {
			if (err) throw err;
			return returnResponse(res, 200, result);
		};
		// This method validate if the sensor is not already registered to that user and if is not yet, save it
		let onGetUserSensors = function (err, result) {
			if (err) throw err;
			var sameIdentificator = result.filter((item) => identificators.indexOf(item.identificator) != -1);
			if (sameIdentificator.length == 0) return returnResponse(res, 400, `Identificator ${identificator} is not registered on your account`);
			return getMongoData(identificators, sinceDate, toDate, postProcess);
		}
		// Get and return all sensors by user
		getSensorsByUserId(userId, onGetUserSensors);
	});


	app.post('/water', function (req, res) {
		// Get token
		let token = req.query.token;
		// Validate if the token exists
		if (!token) return returnResponse(res, 401, 'You are not allowed to perform that action');
		console.debug("gived token", token);
		let userId = getUserByToken(token);
		// Validate if the token returned correct user id
		if (!userId) return returnResponse(res, 401, 'You are not allowed to perform that action');
		let identificator = (req.body.identificator);
		if (!identificator) return returnResponse(res, 400, 'You must send a valid idetificator');
		// This method validate if the sensor is registered to that user
		let onGetUserSensors = function (err, result) {
			if (err) throw err;
			var sameIdentificator = result.filter((item) => item.identificator == identificator);
			if (sameIdentificator.length == 0) return returnResponse(res, 400, `Identificator ${identificator} is not registered on your account`);
			mqttClient.publish(topic, identificator, { qos: 0, retain: false }, (error) => {
				if (error) {
					console.error(error)
				}
			})
			return returnResponse(res, 200, `Water activated`)
		}
		// Get and return all sensors by user
		getSensorsByUserId(userId, onGetUserSensors);
	});

}

