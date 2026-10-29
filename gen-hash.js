const bcrypt = require('bcryptjs');

// Zet hier je eigen verzonnen wachtwoorden tussen de aanhalingstekens
const hashRolf = bcrypt.hashSync('Rolf17', 10);
const hashTim = bcrypt.hashSync('Tim17', 10);

console.log('Hash voor Rolf:', hashRolf);
console.log('Hash voor Tim:', hashTim);