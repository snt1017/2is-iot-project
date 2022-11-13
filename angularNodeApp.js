// import
const { Server } = require("socket.io");
const express = require('express');
const http = require('http');
const mqtt = require('mqtt')
const bodyParser = require("body-parser")
let mysql = require('mysql');

// Avoiding mongodb error
const { TextDecoder, TextEncoder } = require("util");
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const { MongoClient } = require('mongodb');

// Start main servers
const app = express();
// app.use(bodyParser.urlencoded({
//   extended: true
// }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server);

// Connect to databases

// MySql

let db = mysql.createConnection(
  {
    host: 'localhost',
    user: '22108560',
    password: '8327GG',
    database: 'db_22108560_2',
  }
);

db.connect((err) => {
  if (err) throw err;
  console.log('Connected!');
});

// MongoDB

const url = 'mongodb://localhost:27017/';
const mongoClient = new MongoClient(url);


// MQTT Conection

// const mqttHost = 'etu-web2.ut-capitole.fr'
// const mqttPort = '1883'
// const mqttConnectUrl = `mqtt://${mqttHost}:${mqttPort}`
// const mqttClient = mqtt.connect(mqttConnectUrl, {
//   clean: true,
//   connectTimeout: 4000,
//   username: 'user1',
//   password: '#user1#',
//   reconnectPeriod: 1000,
// })

const mqttHost = '10.12.220.129';
const mqttPort = '1883'
const mqttConnectUrl = `mqtt://${mqttHost}:${mqttPort}`
const mqttClient = mqtt.connect(mqttConnectUrl)


// load routes: define controller which act on db
let routes = require('./components/routes.js');
app.use(express.static(__dirname + '/public'));
routes(app, db, mqttClient, io, mongoClient);

// Start nodejs
let port = 3016
server.listen(port, () => {
  console.log(`App listening on port ${port}`)
});

