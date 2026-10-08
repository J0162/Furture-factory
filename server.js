const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const {authenticator} = require('otplib');
const fs = require('fs');
const path = require('path');
const { userInfo } = require('os');
const { json } = require('stream/consumers');

const app = express();
const USERS_FILE = path.join(__dirname, 'users.json');

if (!fs.existsSync(USERS_FILE)) {
    const profile = {jason: {hash: bcrypt.hashSync('1a2a3a', 10), totpSecret: null} };
    fs.writeFileSync(USERS_FILE, JSON.stringify({jason: {hash: bcrypt.hashSync('1a2a3a', 10), totpSecret: null} }, null, 2));
}
const loadUsers = () => JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
const saveUsers = (u) => fs.writeFileSync(USERS_FILE, JSON.stringify(u, null , 2));
app.use(express.urlencoded({ extended: false}));
app.use(session({
    secret: 'veranderd naar iets willekeurig',
    resave: false,
    saveUninitialized: false,
    cookie: {httpOnly: true, sameSite: 'lax', maxAge: 30 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, 'openbaar')));

const view = (name) => (req, res) => res.sendFile(path.join(__dirname, 'beveiligd', name));

app.post('/login', (req, res) => {
    const { uname, psw } = req.body;
    const user = loadUsers() [uname];
    if (!user || !bcrypt.compareSync(psw || '', user.hash)) {
        return res.redirect('/login.html?error=1');
    }
    req.session.regenerate(() => {
        req.session.pendingUser = uname;
        req.session.attemps = 0;
        res.redirect(user.totpSecret ? '/2fa' : '/2fa/setup');
    });
});

const needPending = (req, res, next) =>
    req.session.pendingUser ? next() : res.redirect('/login.html');

app.get('/2fa', needPending, view('verify.html'));
app.get('/2fa/setup', needPending, view('setup.html'));

app.get('/api/2fa/qr', needPending, async (req, res) => {
    req.session.tempSerect = authenticator.generateSecret();
    const otpath = authenticator.keyuri(req.session.pendingUser, 'Dashboard', req.session.tempSerect);
    res.json({ qr: await QRCode.toDataURL(otpath), secret: req.session.tempSerect });
});

app.get('/2fa/reset', needPending, (req, res) => {
    const users = loadUsers();
    const name = req.session.pendingUser;
    if (users[name]) {
        users[name].totpSecret = null;
        saveUsers(users);
    }
    res.redirect('/2fa/setup');
});

app.post('/2fa/verify', needPending, (req, res) => {
    const users = loadUsers();
    const name = req.session.pendingUser;
    const user = users[name];

    if (!user) {
        return res.redirect('/login.html');
    }

    if (++req.session.attemps > 5) {
        return req.session.destroy(() => res.redirect('/login.html?error=2'));
    }
    
    const token = String(req.body.code || '').replace(/\s/g, '');
    const secret = req.session.tempSerect || user.totpSecret;
    const isSetup = !user.totpSecret;
    
    console.log('Verwacht secret:', secret, 'Ontvangen token:', token);

    if (!secret || !authenticator.check(token, secret)) {
        const back = isSetup ? '/2fa/setup' : '/2fa';
        return res.redirect(back + '?error=1');
    }

    if (isSetup) { 
        user.totpSecret = secret; 
        saveUsers(users); 
    }

    req.session.regenerate(() => {
        req.session.user = name;
        delete req.session.tempSerect;
        res.redirect('/dashboard');
    });
});

const needAuth = (req, res, next) =>
    req.session.user ? next() : res.redirect('/login.html');
app.get('/dashboard', needAuth, view('dashboard bestellingen.html'));

const PY = 'http://127.0.0.1:8000';
const KLEUREN = {1: 'Rood', 2: 'Blauw', 3: 'Groen' };
const GEWICHTEN = {1: 15, 2: 25, 3: 50,};

const haalOrders = async () => {
    const r = await fetch(`${PY}/Bestellingen`);
    if (!r.ok) throw new Error ('API' + r.status);
    return r.json();
};
const verloop = [];
const meet = async () => {
    try{
        const o = await haalOrders();
        verloop.push({ t:Date.now(), open: o.filter(b => !b.ColorSorted).length});
        if (verloop.length > 360) verloop.shift();
    } catch {}
};
meet();
setInterval(meet, 10000);

app.get('/api/bestellingen', needAuth, async (req, res) => {
    try {
        const orders = await haalOrders();
        const open = orders.filter(o => !o.ColorSorted);

        const producten = {};
        open.forEach(o => {
            const naam = `${KLEUREN[o.Color]} (${GEWICHTEN[o.Weight]} kg)`;
            producten[naam] = (producten[naam] || 0) + 1;
        });

        res.json({
            totaal: orders.length,
            open: open.length,
            klaar: orders.length - open.length,
            producten,
            verloop,
            bestellingen: orders.map(o => ({
                id: o.IDPackage,
                kleur: KLEUREN[o.Color],
                gewicht: GEWICHTEN[o.Weight],
                klaar: o.ColorSorted
            }))
        });
    } catch {
        res.status(502).json({ error: 'Python-server niet bereikbaar' });
    }
});
app.post('/api/bestellingen', needAuth, express.json(), async (req, res) => {
    const kleur = Number(req.body.kleur), gewicht = Number(req.body.gewicht);
    if (![1, 2, 3].includes(kleur) || ![1, 2, 3].includes(gewicht)) {
        return res.status(400).json({ error: 'kleur en gewicht moeten 1, 2 of 3 zijn' });
    }
    const params = new URLSearchParams({ NieuwKleur: kleur, NieuwGewicht: gewicht });
    const r = await fetch(`${PY}/NewBestelling?${params}`, { method: 'POST' });
    res.sendStatus(r.ok ? 204 : 502);
});

app.post('/api/bestellingen/:id/klaar', needAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.sendStatus(400);
    const r = await fetch(`${PY}/ColorSet?IDNumber=${id}`, { method: 'POST' });
    res.sendStatus(r.ok ? 204 : 502);
});

app.post('/api/bestellingen/:id/verwijder', needAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.sendStatus(400);
    const r = await fetch(`${PY}/RemoveBestelling?IDNumber=${id}`, { method: 'POST' });
    res.sendStatus(r.ok ? 204 : 502);
});

app.post('/logout', (req, res) => req.session.destroy(() => res.redirect('/login.html')));

app.get('/', (req, res) => res.redirect('/login.html'));
 
app.listen(3000, () => console.log('Open http://localhost:3000'));