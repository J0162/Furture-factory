const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const {authenticator} = require('otplib');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto'); 
const multer = require('multer');
const nodemailer = require('nodemailer')

const app = express();
const USERS_FILE = path.join(__dirname, 'users.json');

if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, '{}')
    console.log('users.json aangemaakt. gebruikers toevoegen in gen-hash.js')
}
const loadUsers = () => JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
const saveUsers = (u) => fs.writeFileSync(USERS_FILE, JSON.stringify(u, null , 2));

app.disable('x-powered-by');
function stuurFout(req, res, status, tekst) {
    if (req.path.startsWith('/api/')) {
        return res.status(status).json({ ok: false, error: tekst });
    }
    return res.status(status).send(tekst);
}

app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self'; " +
        "style-src 'self' https://cdnjs.cloudflare.com; " +
        "font-src 'self' https://cdnjs.cloudflare.com; " +
        "img-src 'self' data:; " +
        "connect-src 'self' https://api.pdok.nl; " +
        "form-action 'self'; " +
        "frame-ancestors 'none'; " +
        "base-uri 'self'; " +
        "object-src 'none' ");
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

        const isBestand = /\.(css|js|png|jpg|jpeg|gif|svg|ico)$/i.test(req.path);
        if (isBestand) {
            res.setHeader('Cache-Control', 'no-cache');
        } else { 
            res.setHeader('cache-Control', 'no-store');
        }
    next()
    })

app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(express.json({ limit: '10kb'}));

app.use(session({
    name: 'sessie',
    secret: crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {httpOnly: true, sameSite: 'strict', maxAge: 30*60*1000}
}));

app.get('/api/csrf', (req,res) => {
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }
    res.json({ token: req.session.csrfToken});
});

app.use((req, res, next) => {
    if (req.method !== 'POST') return next();
    const token = req.get('X-CSRF-Token') || (req.body && req.body._csrf);
    if (!token || token !== req.session.csrfToken) {
        return stuurFout(req, res, 403, 'Ongeldig CSRF-token. Herlaad de pagina en probeer het opnieuw.');
    }
    next();
});
app.use(express.static(path.join(__dirname, 'openbaar'), {cacheControl: false, redirect: false}));
app.use(express.static(path.join(__dirname, '..', '..', 'website', 'Frontend'), {cacheControl: false, redirect: false }));

const view = (name) => (req, res) =>
    res.sendFile(path.join(__dirname, 'beveiligd', name), {cacheControl: false});

const BEDRIJF_EMAIL = 'refheru@sorteercentrum.com';
const CONTACT_FILE = path.join(__dirname, 'contactbericht.json');
const UPLOAD_MAP = path.join(__dirname, 'contact_uploads');

const upload = multer ({
    dest: UPLOAD_MAP,
    limits: { fileSize: 5*1024*1024, files:10}
});

let transporterBelofte = null;
const haalTransporter = () => {
    if (!transporterBelofte) {
        transporterBelofte = nodemailer.createTestAccount().then(account =>
            nodemailer.createTransport({
                host: account.smtp.host,
                port: account.smtp.port,
                secure: account.smtp.secure,
                auth: {user: account.user, pass: account.pass}
            })
        ).catch(err => {
            transporterBelofte = null;
            throw err;
        });
    }
    return transporterBelofte;
}
app.post('/api/contact', (req, res) => {
    upload.array('bestanden[]', 10)(req, res, async (err) => {
        if (err) {
            const tekst = err.code === 'LIMIT_FILE_SIZE' ? 'Een bestand is groter dan 5 MB.' : 'Bestanden konden niet worden ontvangen.';
            return res.status(400).json({ ok: false, error: tekst });
        }

        const voornaam = String(req.body.Voornaam || '').trim();
        const achternaam = String(req.body.Achternaam || '').trim();
        const email = String(req.body['e-mail'] || '').trim();
        const onderwerp = String(req.body.Onderwerp || '').trim() || '(geen onderwerp)';
        const bericht = String(req.body.Bericht || '').trim();
        const bestanden = req.files || [];

        if (!voornaam || !bericht || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ ok: false, error: 'Vul je voornaam, een geldig e-mailadres en een bericht in.' });
        }


        const berichten = fs.existsSync(CONTACT_FILE) ? JSON.parse(fs.readFileSync(CONTACT_FILE, 'utf8')) : [];
        berichten.push({
            tijd: new Date().toISOString(),
            voornaam, achternaam, email, onderwerp, bericht,
            bestanden: bestanden.map(b => ({ naam: b.originalname, opgeslagenAls: b.filename, grootte: b.size }))
        });
        fs.writeFileSync(CONTACT_FILE, JSON.stringify(berichten, null, 2));

        let mailVerstuurd = false;
        try {
            const transporter = await haalTransporter();
            const info = await transporter.sendMail({
                from: '"Contactformulier" <noreply@groenwebshop.nl>',
                to: BEDRIJF_EMAIL,
                replyTo: email,
                subject: 'Contactformulier: ' + onderwerp,
                text: `Naam: ${voornaam} ${achternaam}\nE-mail: ${email}\n\n${bericht}`,
                attachments: bestanden.map(b => ({ filename: b.originalname, path: b.path }))
            });
            mailVerstuurd = true;
            console.log('Contactmail verstuurd. Bekijken:', nodemailer.getTestMessageUrl(info));
        } catch (e) {
            console.log('Mail versturen mislukt (bericht is wel opgeslagen):', e.message);
        }

         res.json({ ok: true, naar: BEDRIJF_EMAIL, mailVerstuurd, bijlagen: bestanden.length });
    });
});

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
const needNietGekoppeld = (req, res, next) => {
    const user = loadUsers()[req.session.pendingUser];
    if (!user) return res.redirect('/login.html');
    if(user.totpSecret) return res.redirect('/2fa');
    next()
};

app.get('/2fa/setup', needPending, needNietGekoppeld, view('setup.html'));

app.get('/api/2fa/qr', needPending, async (req, res) => {
    const user = loadUsers()[req.session.pendingUser];
    if (!user || user.totpSecret) {
        return res.status(403).json({ ok:false, error: 'Authenticator is gekoppeld.'});
    } 
    req.session.tempSerect = authenticator.generateSecret();
    const otpath = authenticator.keyuri(req.session.pendingUser, 'Dashboard', req.session.tempSerect);
    res.json({ qr: await QRCode.toDataURL(otpath), secret: req.session.tempSerect});
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
    const isSetup = !user.totpSecret;
    const secret = isSetup ? req.session.tempSerect : user.totpSecret

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
app.get('/efficientie', needAuth, view('dashboard efficiëntie.html'));

const PY = 'http://145.93.112.58:8000';
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

});app.post('/api/bestellingen', needAuth, async (req, res) => {

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

const MACHINES_PAD = '/Machines';

app.get('/api/machines', needAuth, async (req, res) => {
    try {
        const r = await fetch(`${PY}/Machines`);
        if (r.ok) {
            const contentType = r.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                return res.json(await r.json());
            }
        }
        res.json([]);
    } catch {
        res.json([]);
    }
});

app.post('/logout', (req, res) => req.session.destroy(() => res.redirect('/login.html')));

app.get('/', (req, res) => res.redirect('/login.html'));

fetch(`${PY}/events?kanalen=factory`).then(async (r) => {
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let tekst = '';
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        tekst += decoder.decode(value, { stream: true });
        const einde = tekst.indexOf('\n\n');
        if (einde !== -1) {
            fs.writeFileSync(path.join(__dirname, 'bericht.txt'), tekst.slice(0, einde));
            console.log('Bericht opgeslagen in bericht.txt');
            reader.cancel();
            break;
        }
    }
}).catch((err) => console.log('Stream fout:', err.message, err.cause));

app.listen(3000, () => console.log('Open http://localhost:3000'));

app.use((req, res) => {
    res.status(404).send('Pagina niet gevonden.');
});
