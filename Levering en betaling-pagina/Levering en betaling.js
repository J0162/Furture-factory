        const API_URL = "http://127.0.0.1:8000";

        const KLEUR_CODE   = { "Rood": 1, "Blauw": 2, "Groen": 3 };
        const GEWICHT_CODE = { "Rood": 1, "Blauw": 2, "Groen": 3 }; 

        async function stuurBestelling(cart) {
            for (const item of cart) {
                const kleur = KLEUR_CODE[item.name];
                const gewicht = GEWICHT_CODE[item.name];
                if (kleur === undefined || gewicht === undefined) {
                    throw new Error("Onbekend product: " + item.name);
                }

                for (let i = 0; i < item.aantal; i++) {
                    const params = new URLSearchParams({ NieuwKleur: kleur, NieuwGewicht: gewicht });
                    await fetch(`${API_URL}/NewBestelling?${params}`, {
                        method: "POST",
                        mode: "no-cors"
                    });
                }
            }
        }

        document.getElementById("cvv").addEventListener("input", function () {
            this.value = this.value.replace(/[^0-9]/g, "").slice(0, 4);
        });

        document.getElementById("cnum").addEventListener("input", function () {
            this.value = this.value.replace(/[^0-9]/g, "").slice(0, 16);
        });

        document.getElementById("ideal-knop").addEventListener("click", function () {
            window.location.href = "ideal-betaling.html";
        });

        var cart = [];
        try {
            cart = JSON.parse(localStorage.getItem("winkelwagen")) || [];
        } catch (e) {
            cart = [];
        }

        function formatPrijs(bedrag) {
            return bedrag.toFixed(2).replace(".", ",");
        }

        var lijst = document.getElementById("cart-lijst");
        var totaal = 0;
        var aantal = 0;

        if (cart.length === 0) {
            lijst.textContent = "Je winkelwagen is leeg.";
        }

        cart.forEach(function (item) {
            var regel = item.price * item.aantal;
            totaal += regel;
            aantal += item.aantal;

            var p = document.createElement("p");
            p.textContent = item.name + " (" + item.aantal + "x)";
            var prijs = document.createElement("span");
            prijs.className = "price";
            prijs.textContent = "€" + formatPrijs(regel);
            p.appendChild(prijs);
            lijst.appendChild(p);
        });

        document.getElementById("cart-aantal").textContent = aantal;
        document.getElementById("cart-totaal").textContent = formatPrijs(totaal);

        const BESTEL_PAGINA = "../Bestellen.html";
        const melding = document.getElementById("melding");

        document.querySelector("form").addEventListener("submit", async function (e) {
            e.preventDefault();
            if (cart.length === 0) { alert("Je winkelwagen is leeg"); return; }

            const knop = this.querySelector('input[type="submit"]');
            knop.disabled = true;
            knop.value = "Bezig met versturen...";

            try {
                await stuurBestelling(cart);
                localStorage.removeItem("winkelwagen");
                localStorage.setItem("BestellingGelukt", "1");

                melding.style.display = "block";
                melding.style.background = "#d4edda";
                melding.textContent = "Je bestelling is verstuurd! Je wordt teruggestuurd naar de bestelpagina...";
                melding.scrollIntoView({ behavior: "smooth", block: "center" });
                setTimeout(function () { window.location.href = BESTEL_PAGINA; }, 3000);
            } catch (err) {
                console.error(err);
                melding.style.display = "block";
                melding.style.background = "#f8d7da";
                melding.textContent = "Bestelling mislukt: " + err.message + ". Probeer het opnieuw.";
                melding.scrollIntoView({ behavior: "smooth", block: "center" });
                knop.disabled = false;
                knop.value = "Betalen";
            }
        });

       const adresInput = document.getElementById("adres");
const suggestiesLijst = document.getElementById("adres-suggesties");
const PDOK = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/";
let zoekTimer;

adresInput.addEventListener("input", function () {
    clearTimeout(zoekTimer);
    const zoekterm = adresInput.value.trim();

    if (zoekterm.length < 3) {
        suggestiesLijst.innerHTML = "";
        return;
    }
    zoekTimer = setTimeout(() => zoekAdressen(zoekterm), 300);
});

async function zoekAdressen(zoekterm) {
    try {
        const url = PDOK + "suggest?fq=type:adres&rows=6&q=" + encodeURIComponent(zoekterm);
        const antwoord = await fetch(url);
        const data = await antwoord.json();

        suggestiesLijst.innerHTML = "";
        data.response.docs.forEach(function (adres) {
            const li = document.createElement("li");
            li.textContent = adres.weergavenaam;
            li.addEventListener("click", () => kiesAdres(adres.id));
            suggestiesLijst.appendChild(li);
        });
    } catch (e) {
        suggestiesLijst.innerHTML = "";
    }
}

async function kiesAdres(id) {
    try {
        const url = PDOK + "lookup?id=" + encodeURIComponent(id) +
            "&fl=straatnaam,huisnummer,huisletter,huisnummertoevoeging,postcode,woonplaatsnaam,provincienaam";
        const antwoord = await fetch(url);
        const data = await antwoord.json();
        const a = data.response.docs[0];

        const nummer = (a.huisnummer || "") + (a.huisletter || "") +
            (a.huisnummertoevoeging ? "-" + a.huisnummertoevoeging : "");

        let postcode = a.postcode || "";
        if (!postcode && a.weergavenaam) {
            const m = a.weergavenaam.match(/\d{4}s?[A-Za-z]{2}/);
            postcode = m ? m[0] : "";
        }

        adresInput.value = a.straatnaam + " " + nummer + "," + a.woonplaatsnaam + "," + a.provincienaam;
        document.getElementById("postcode").value = postcode;
    } catch (e) {}

    suggestiesLijst.innerHTML = "";
}

document.addEventListener("click", function (event) {
    if (!event.target.closest(".adres-wrapper")) {
        suggestiesLijst.innerHTML = "";
    }
});
