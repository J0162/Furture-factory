var VERVERS_MS = 3000;
var GOED = 90;
var KANTELPUNT = 80;

var onderdelen = [
    { nr: 1, naam: "Vrachtwagens - input", verwerkt: 'totaal', machines: [
        { naam: "Truck1 ouput2", tijd: null},
        { naam: "Truck1 ouput1", tijd: null},
    ]},
    { nr: 2, naam: "Import queue", verwerkt: 'totaal', machines: [
        { naam: "import_1", tijd: null},
        { naam: "import_2", tijd: null},
    ]},
    { nr: 3, naam: "Heftruck naar inkomst rack", verwerkt: 'totaal', machines: [
        { naam: "Transporter1", tijd: null},
        { naam: "Transporter2", tijd: null},
    ]},
    { nr: 4, naam: "Drive-in racken - begin", verwerkt: 'totaal', machines: [
        { naam: "DriveInRack1", tijd: null},
    ]},
    { nr: 5, naam: "Heftruck begin fabriekproces", verwerkt: 'totaal', machines: [
        { naam: "Transporter3", tijd: null},
    ]},
    { nr: 6, naam: "Begin fabriekproces", verwerkt: 'totaal', machines: [
        { naam: "Separator1", tijd: null},
    ]},
    { nr: 7, naam: "Wegen", verwerkt: 'totaal', machines: [
        { naam: "Processor1", tijd: null},
        { naam: "Processor2", tijd: null},
    ]},
    { nr: 8, naam: "Sorters", verwerkt: 'totaal', machines: [
        { naam: "Processor3", tijd: null},
        { naam: "Processor4", tijd: null},
        { naam: "Processor5", tijd: null},
    ]},
    { nr: 9, naam: "Robotarmen", verwerkt: 'totaal', machines: [
        { naam: "Robot1", tijd: null},
        { naam: "Robot2", tijd: null},
        { naam: "Robot3", tijd: null},
    ]},
    { nr: 10, naam: "Ververs", verwerkt: 'totaal', machines: [
        { naam: "Processor10", tijd: null},
        { naam: "Processor11", tijd: null},
        { naam: "Processor12", tijd: null},
        { naam: "Processor16", tijd: null},
        { naam: "Processor17", tijd: null},
        { naam: "Processor18", tijd: null},
        { naam: "Processor22", tijd: null},
        { naam: "Processor23", tijd: null},
        { naam: "Processor24", tijd: null},
    ]},
    { nr: 11, naam: "Doos inpakkers", verwerkt: 'totaal', machines: [
        { naam: "Processor13", tijd: null},
        { naam: "Processor14", tijd: null},
        { naam: "Processor15", tijd: null},
        { naam: "Processor19", tijd: null},
        { naam: "Processor20", tijd: null},
        { naam: "Processor21", tijd: null},
        { naam: "Processor25", tijd: null},
        { naam: "Processor26", tijd: null},
        { naam: "Processor27", tijd: null},
    ]},
    { nr: 12, naam: "Pallet inpakkers", verwerkt: 'totaal', machines: [
        { naam: "Processor28", tijd: null},
        { naam: "Processor29", tijd: null},
        { naam: "Processor30", tijd: null},
        { naam: "Processor31", tijd: null},
        { naam: "Processor32", tijd: null},
        { naam: "Processor33", tijd: null},
        { naam: "Processor36", tijd: null},
        { naam: "Processor34", tijd: null},
        { naam: "Processor35", tijd: null},
    ]},
    { nr: 13, naam: "Queue kleuren en object", verwerkt: 'totaal', machines: [
        { naam: "object 1_1", tijd: null},
        { naam: "object 1_2", tijd: null},
        { naam: "object 1_3", tijd: null},
        { naam: "object 2_1", tijd: null},
        { naam: "object 2_2", tijd: null},
        { naam: "object 2_3", tijd: null},
        { naam: "object 3_1", tijd: null},
        { naam: "object 3_2", tijd: null},
        { naam: "object 3_3", tijd: null},
    ]},
    { nr: 14, naam: "Heftruck naar warehouse", verwerkt: 'totaal', machines: [
        { naam: "Transporter obj 3", tijd: null},
        { naam: "Transporter obj3", tijd: null},
        { naam: "Transporter obj 2", tijd: null},
        { naam: "transporter obj1", tijd: null},
        { naam: "Transporter obj2", tijd: null},
        { naam: "Transporter obj1", tijd: null},
    ]},
    { nr: 15, naam: "Drive-in racken - warenhuis", verwerkt: 'totaal', machines: [
        { naam: "warehose rack1", tijd: null},
        { naam: "warehose rack2", tijd: null},
        { naam: "warehose rack3", tijd: null},
    ]},
    { nr: 16, naam: "Heftruck export", verwerkt: 'totaal', machines: [
        { naam: "export1", tijd: null},
        { naam: "export2", tijd: null},
    ]},
    { nr: 17, naam: "Export queue", verwerkt: 'totaal', machines: [
        { naam: "export 2", tijd: null},
        { naam: "export 1", tijd: null},
    ]},
    { nr: 18, naam: "Export truck", verwerkt: 'totaal', machines: [
        { naam: "Truck1 ouput", tijd: null},
        { naam: "Truck2 output", tijd: null},
    ]},
    { nr: 19, naam: "Vrachtwagens - output", verwerkt: 'totaal', machines: [
        { naam: "Truck1 ouput", tijd: null},
        { naam: "Truck2 output", tijd: null},
    ]}
];

var resultaten = [];

function haalData() {
    return fetch("/api/machines")
        .then(function (response) {
            if (response.redirected || response.status === 401) {
                window.location.href = "/login.html";
                throw new Error("Niet ingelogd");
            }
            if (!response.ok) {
                throw new Error("Server gaf status " + response.status);
            }
            return response.json();
        });
}

function zoekMachine(naam, lijst) {
    for (var i = 0; i < lijst.length; i++) {
        if (lijst[i].Naam === naam) {
            return lijst[i];
        }
    }
    return null;
}

function berekenAlles(lijst) {
    var uitkomst = [];

    for (var i = 0; i < onderdelen.length; i++) {
        var onderdeel = onderdelen[i];
        var machines = [];
        var som = 0;
        var teller = 0;

        for (var j = 0; j < onderdeel.machines.length; j++) {
            var m = onderdeel.machines[j];
            var gegevens = zoekMachine(m.naam, lijst);
            
            var benutting = null;
            var inWaarde = "-";
            var uitWaarde = "-";
            var aanwezig = "-";
            var gemTijd = "-";

            if (gegevens !== null) {
                benutting = gegevens.Benutting !== undefined ? gegevens.Benutting : (gegevens.benutting !== undefined ? gegevens.benutting : null);
                inWaarde = gegevens.In !== undefined ? gegevens.In : (gegevens.in !== undefined ? gegevens.in : "-");
                uitWaarde = gegevens.Uit !== undefined ? gegevens.Uit : (gegevens.uit !== undefined ? gegevens.uit : "-");
                aanwezig = gegevens.NuAanwezig !== undefined ? gegevens.NuAanwezig : (gegevens.nuAanwezig !== undefined ? gegevens.nuAanwezig : (gegevens["Nu aanwezig"] !== undefined ? gegevens["Nu aanwezig"] : "-"));
                gemTijd = gegevens.GemTijd !== undefined ? gegevens.GemTijd : (gegevens.gemTijd !== undefined ? gegevens.gemTijd : (gegevens["Gem. tijd (s)"] !== undefined ? gegevens["Gem. tijd (s)"] : "-"));

                if (benutting !== null) {
                    som = som + benutting;
                    teller++;
                }
            }

            machines.push({ 
                naam: m.naam, 
                tijd: m.tijd,
                in: inWaarde, 
                uit: uitWaarde, 
                nuAanwezig: aanwezig, 
                gemTijd: gemTijd, 
                benutting: benutting 
            });
        }

        var gemiddelde = null;
        if (teller > 0) {
            gemiddelde = som / teller;
        }
        uitkomst.push({ nr: onderdeel.nr, naam: onderdeel.naam, machines: machines, benutting: gemiddelde });
    }
    return uitkomst;
}

function kleurKlasse(procent) {
    if (procent === null) return "";
    if (procent >= GOED) return "groen";
    if (procent >= KANTELPUNT) return "geel";
    return "rood";
}

function alsProcent(procent) {
    if (procent === null) return "-";
    return procent.toFixed(0) + "%";
}

function zetTekst(id, tekst) {
    var elem = document.getElementById(id);
    if (elem) elem.textContent = tekst;
}

function toonMelding(tekst) {
    var melding = document.getElementById("melding");
    if (melding) {
        melding.textContent = tekst;
        melding.hidden = (tekst === "");
    }
}

function toonMachineTabel() {
    var tbody = document.getElementById("machinetabel");
    if (!tbody) return;
    var html = "";

    for (var i = 0; i < resultaten.length; i++) {
        var o = resultaten[i];

        for (var j = 0; j < o.machines.length; j++) {
            var m = o.machines[j];
            var breedte = m.benutting !== null ? m.benutting : 0;

            html += "<tr>";
            html += "<td>" + o.nr + ". " + o.naam + "</td>";
            html += "<td>" + m.naam + "</td>";
            html += "<td>" + m.in + "</td>";
            html += "<td>" + m.uit + "</td>";
            html += "<td>" + m.nuAanwezig + "</td>";
            html += "<td>" + m.gemTijd + "</td>";
            html += "<td><span class='badge " + kleurKlasse(m.benutting) + "'>" + alsProcent(m.benutting) + "</span>";
            html += "<div style='background:#eeeeee; height:8px;'>";
            html += "<div class='" + kleurKlasse(m.benutting) + "' style='width:" + breedte + "%; height:8px;'></div>";
            html += "</div></td>";
            html += "</tr>";
        }
    }
    tbody.innerHTML = html;
}

function toonBlokken() {
    var som = 0;
    var aantal = 0;
    var hoogste = null;
    var laagste = null;

    for (var i = 0; i < resultaten.length; i++) {
        var o = resultaten[i];
        if (o.benutting === null) continue;
        som = som + o.benutting;
        aantal++;
        if (hoogste === null || o.benutting > hoogste.benutting) hoogste = o;
        if (laagste === null || o.benutting < laagste.benutting) laagste = o;
    }

    if (aantal === 0) {
        zetTekst("gemiddeld", "-");
        zetTekst("knelpunt", "-");
        zetTekst("knelpunt-pct", "");
        zetTekst("onderbenut", "-");
        zetTekst("onderbenut-pct", "");
        toonMelding("FlexSim heeft nog geen gegevens doorgegeven.");
        return;
    }

    zetTekst("gemiddeld", alsProcent(som / aantal));
    zetTekst("knelpunt", hoogste.naam);
    zetTekst("knelpunt-pct", alsProcent(hoogste.benutting));
    zetTekst("onderbenut", laagste.naam);
    zetTekst("onderbenut-pct", alsProcent(laagste.benutting));
    toonMelding("");
}

function ververs() {
    haalData()
        .then(function (lijst) {
            resultaten = berekenAlles(lijst);
            toonBlokken();
            toonMachineTabel();
        })
        .catch(function (fout) {
            toonMelding("Gegevens ophalen mislukt: " + fout.message);
        });
}

ververs();
setInterval(ververs, VERVERS_MS);
