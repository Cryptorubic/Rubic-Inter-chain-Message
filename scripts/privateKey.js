var keythereum = require("keythereum");
var datadir = "./";
var address= "503cef47ce5e37aa62544a363bef3c9b62d42116";
const password = "";
var keyObject = keythereum.importFromFile(address, datadir);
var privateKey = keythereum.recover(password, keyObject);
console.log(privateKey.toString('hex'));
