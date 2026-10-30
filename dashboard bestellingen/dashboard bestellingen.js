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
  var svg = document.getElementById(svgId);
  var titel = svg.parentElement.querySelector("h2").textContent;
  var datum = new Date().toLocaleString("nl-NL");

  var canvas = document.createElement("canvas");
  canvas.width = 1684;
  canvas.height = 1190;
  var ctx = canvas.getContext("2d");

  var plaatje = new Image();
  var svgTekst = new XMLSerializer().serializeToString(svg);
  plaatje.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgTekst);

  plaatje.onload = function () {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "black";
    ctx.font = "bold 48px Arial";
    ctx.fillText(titel, 80, 130);

    ctx.font = "26px Arial";
    ctx.fillText("Opgeslagen op " + datum, 80, 180);

    ctx.drawImage(plaatje, 80, 230, 1524, 635);

    ctx.font = "24px Arial";
    ctx.fillText("Bron: " + document.title + ", gegevens van de fabriek, opgehaald op " + datum, 80, 1110);

    var jpeg = canvas.toDataURL("image/jpeg");
    var pdf = maakPdf(jpeg, canvas.width, canvas.height);

    var link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
    link.download = naam + ".pdf";
    link.click();
  };
}

function maakPdf(jpeg, breedte, hoogte) {
  var bytes = atob(jpeg.split(",")[1]);
  var hex = "";
  for (var i = 0; i < bytes.length; i++) {
    var code = bytes.charCodeAt(i).toString(16);
    if (code.length === 1) {
      code = "0" + code;
    }
    hex = hex + code;
  }
  hex = hex + ">";

  var tekenen = "q 842 0 0 595 0 0 cm /Plaatje Do Q";

  var objecten = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /XObject << /Plaatje 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /XObject /Subtype /Image /Width " + breedte + " /Height " + hoogte +
      " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length " + hex.length +
      " >>\nstream\n" + hex + "\nendstream",
    "<< /Length " + tekenen.length + " >>\nstream\n" + tekenen + "\nendstream"
  ];

  var pdf = "%PDF-1.4\n";
  var plekken = [];
  for (var j = 0; j < objecten.length; j++) {
    plekken.push(pdf.length);
    pdf = pdf + (j + 1) + " 0 obj\n" + objecten[j] + "\nendobj\n";
  }

  var startInhoud = pdf.length;
  pdf = pdf + "xref\n0 6\n0000000000 65535 f \n";
  for (var k = 0; k < plekken.length; k++) {
    pdf = pdf + String(plekken[k]).padStart(10, "0") + " 00000 n \n";
  }
  pdf = pdf + "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" + startInhoud + "\n%%EOF";

  return pdf;
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
