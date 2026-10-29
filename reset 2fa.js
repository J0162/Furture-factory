const fs = require('fs');
const path = require ('path');
const FILE = path.join(__dirname, 'users.json');
const naam = process.argv[2];
if (!naam) {
    console.log ('Gebruik node-reset-2fa.js <je gebruikersnaam>');
    process.exit(1);
}
const users = JSON.parse(fs.readFileSync(FILE, 'utf8'));
if (!users[naam]) {
    console.log('Gebruiker niet gevonden:', naam);
    process.exit(1);
}
users[naam].totpSecret = null;
fs.writeFileSync(FILE, JSON.stringify(users, null, 2));
console.log('2FA gereset voor', naam, '- bij de volgende login krijgt die een QR-code.');