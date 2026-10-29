let csrfToken = "";

async function haalCsrfToken() {
  const res = await fetch('/api/csrf');
  const data = await res.json();
  csrfToken = data.token;
  document.querySelectorAll('input[name="_csrf"]').forEach(veld => veld.value = csrfToken);
}

const KLEURCODES = { Rood: "#d9534f", Blauw: "#337ab7", Groen: "#5cb85c" };

async function laadDashboard() {
  const res = await fetch('/api/bestellingen');
  if (res.redirected) return (location.href = '/login.html');
  if (!res.ok) {
    document.querySelector("h1").textContent = "Bestellingen dashboard (geen verbinding met server)";
    return;
  }
  document.querySelector("h1").textContent = "Bestellingen dashboard";
  const d = await res.json();
  const bestellingen = d.bestellingen;
  const open = bestellingen.filter(b => !b.klaar);

  document.getElementById("totaal").textContent = d.totaal;
  document.getElementById("open").textContent   = d.open;
  document.getElementById("klaar").textContent  = d.klaar;

  const telling = { Rood: 0, Blauw: 0, Groen: 0 };
  open.forEach(b => telling[b.kleur]++);

  const productenDiv = document.getElementById("producten");
  productenDiv.innerHTML = "";
  Object.keys(telling).forEach(k => {
    const balk = document.createElement("div");
    balk.className = "balk balk-" + k;
    balk.style.width = (telling[k] * 5) + "px";
    balk.textContent = k + ": " + telling[k];
    productenDiv.appendChild(balk);
  });

  const tabel = document.getElementById("tabel");
  tabel.innerHTML = "";
  bestellingen.forEach(b => {
    const rij = document.createElement("tr");
    rij.appendChild(maakCel(b.id));
    rij.appendChild(maakCel(b.kleur));
    rij.appendChild(maakCel(b.gewicht + " kg"));
    rij.appendChild(maakCel(b.klaar ? "Afgerond" : "Nog te doen"));
    const knoppen = document.createElement("td");
    if (!b.klaar) knoppen.appendChild(maakKnop("Afronden", b.id, "klaar"));
    knoppen.appendChild(maakKnop("Verwijder", b.id, "verwijder"));
    rij.appendChild(knoppen);
    tabel.appendChild(rij);
  });

  const svg = document.getElementById("grafiek");
  const max = Math.max(1, ...Object.values(telling));
  svg.innerHTML = Object.keys(telling).map((k, i) => {
    const h = (telling[k] / max) * 180;
    return `<rect fill="${KLEURCODES[k]}" x="${60 + i * 150}" y="${210 - h}" width="80" height="${h}"/>
            <text x="${100 + i * 150}" y="230" text-anchor="middle">${k}</text>
            <text x="${100 + i * 150}" y="${200 - h}" text-anchor="middle">${telling[k]}</text>`;
  }).join("");

  const lijn = document.getElementById("lijngrafiek");
  const v = d.verloop;
  if (v.length > 1) {
    const maxOpen = Math.max(1, ...v.map(p => p.open));
    const punten = v.map((p, i) =>
      `${40 + i * (540 / (v.length - 1))},${210 - (p.open / maxOpen) * 180}`).join(" ");
    const tijd = t => new Date(t).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });

    lijn.innerHTML = `<polyline points="${punten}" fill="none" stroke="#337ab7" stroke-width="2"/>
      <text x="40" y="235">${tijd(v[0].t)}</text>
      <text x="580" y="235" text-anchor="end">${tijd(v[v.length - 1].t)}</text>
      <text x="35" y="35" text-anchor="end">${maxOpen}</text>
      <text x="35" y="214" text-anchor="end">0</text>`;
  }
}

function maakCel(tekst) {
  const td = document.createElement("td");
  td.textContent = tekst;
  return td;
}

function maakKnop(tekst, id, soort) {
  const knop = document.createElement("button");
  knop.textContent = tekst;
  knop.addEventListener("click", () => actie(id, soort));
  return knop;
}

function slaGrafiekOp(svgId, naam) {
  const svg = document.getElementById(svgId);
  const tekst = new XMLSerializer().serializeToString(svg);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([tekst], { type: "image/svg+xml" }));
  a.download = naam + ".svg";
  a.click();
}

async function actie(id, soort) {
  await fetch(`/api/bestellingen/${id}/${soort}`, {
    method: 'POST',
    headers: { 'X-CSRF-Token': csrfToken }
  });
  laadDashboard();
}

async function nieuweBestelling() {
  const product = document.getElementById("kies-product");
  const gewicht = document.getElementById("kies-gewicht");
  const melding = document.getElementById("bestel-melding");

  // Allebei gekozen?
  if (!product.value || !gewicht.value) {
    melding.textContent = "Kies eerst een product en een gewicht.";
    melding.className = "fout";
    return;
  }

  const res = await fetch('/api/bestellingen', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken
    },
    body: JSON.stringify({
      kleur: Number(product.value),
      gewicht: Number(gewicht.value)
    })
  });

  if (res.ok) {
    melding.textContent = "Toegevoegd: " + product.selectedOptions[0].text + ", " + gewicht.selectedOptions[0].text;
    melding.className = "gelukt";
    product.value = ""; 
    gewicht.value = "";
  } else {
    melding.textContent = "Toevoegen mislukt (status " + res.status + ")";
    melding.className = "fout";
  }
  laadDashboard();
}

document.getElementById("nieuwe-bestelling").addEventListener("click", nieuweBestelling);

document.getElementById("grafiek-opslaan")
  .addEventListener("click", () => slaGrafiekOp("grafiek", "bestellingen-per-kleur"));
document.getElementById("lijn-opslaan")
  .addEventListener("click", () => slaGrafiekOp("lijngrafiek", "verloop-open"));

haalCsrfToken().then(laadDashboard);
setInterval(laadDashboard, 3000);
