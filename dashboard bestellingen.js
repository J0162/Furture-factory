const KLEUREN = { 1: "Rood", 2: "Blauw", 3: "Groen" };
const KILOS   = { 1: 15, 2: 25, 3: 50 };

async function laadDashboard() {
  const res = await fetch('/api/bestellingen');
  if (res.redirected) return (location.href = '/login.html');
  if (!res.ok) return;
  const d = await res.json();
  const bestellingen = d.bestellingen;         
  
  const open  = bestellingen.filter(b => !b.klaar);
  const klaar = bestellingen.filter(b => b.klaar);

  document.getElementById("totaal").textContent = d.totaal;
  document.getElementById("open").textContent   = d.open;
  document.getElementById("klaar").textContent  = d.klaar;

  const telling = { Rood: 0, Blauw: 0, Groen: 0 };
  open.forEach(b => telling[b.kleur]++);

  document.getElementById("producten").innerHTML =
    Object.keys(telling).map(k =>
      `<div class="balk" style="width:${telling[k] * 5}px">${k}: ${telling[k]}</div>`).join("");

  document.getElementById("tabel").innerHTML = bestellingen.map(b => `
    <tr>
      <td>${b.id}</td>
      <td>${b.kleur}</td>
      <td>${b.gewicht} kg</td>
      <td>${b.klaar ? "Afgerond" : "Nog te doen"}</td>
      <td>
        ${b.klaar ? "" : `<button onclick="actie(${b.id}, 'klaar')">Afronden</button>`}
        <button onclick="actie(${b.id}, 'verwijder')">Verwijder</button>
      </td>
    </tr>`).join("");

  const svg = document.getElementById("grafiek");
  const max = Math.max(1, ...Object.values(telling));
  svg.innerHTML = Object.keys(telling).map((k, i) => {
    const h = (telling[k] / max) * 180;
    return `<rect x="${60 + i * 150}" y="${210 - h}" width="80" height="${h}" fill="steelblue"/>
            <text x="${100 + i * 150}" y="230" text-anchor="middle">${k}</text>
            <text x="${100 + i * 150}" y="${200 - h}" text-anchor="middle">${telling[k]}</text>`;
  }).join("");
}

async function actie(id, soort) {
  await fetch(`/api/bestellingen/${id}/${soort}`, { method: 'POST' });
  laadDashboard();
}

async function nieuweBestelling() {
  await fetch('/api/bestellingen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kleur: 1 + Math.floor(Math.random() * 3),
      gewicht: 1 + Math.floor(Math.random() * 3)
    })
  });
  laadDashboard();
}

laadDashboard();
setInterval(laadDashboard, 3000);