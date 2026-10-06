const API_URL = 'http://127.0.0.1:8000';

function haalBestellingOntvangen() {
    return fetch(`${API_URL}/Bestellingen`)
        .then(response => response.json())
        .then(data => {
            console.log('Bestelling opgehaald uit Python:', data);
            return data;
        })
        .catch(error => {
            console.error('Fout bij ophalen van bestelling:', error);
        });
}

function voegBestellingToe(nieuwKleur, nieuwGewicht) {
    const params = new URLSearchParams({
        NieuwKleur: nieuwKleur,
        NieuwGewicht: nieuwGewicht
    });

    return fetch(`${API_URL}/NewBestelling?${params}`, {
        method: 'POST'
    })
        .then(response => response.json())
        .then(data => {
            console.log('Bestelling toegevoegd:', data);
            return data;
        })
        .catch(error => {
            console.error('Fout bij toevoegen van bestelling:', error);
        });
}

function zetColorsorted(idNumber) {
    return fetch(`${API_URL}/ColorSet?IDNumber=${idNumber}`, {
        method: 'POST'
    })
        .then(response => response.json())
        .then(data => {
            console.log('Bestelling gesorteerd:', data);
            return data;
        })
        .catch(error => {
            console.error('Fout bij sorteren van bestelling:', error);
        });
}

function verwijderBestellingOntvangen(bestellingId) {
    return fetch(`${API_URL}/RemoveBestelling?IDNumber=${bestellingId}`, {
        method: 'POST'
    })
        .then(response => response.json())
        .then(data => {
            console.log('Bestelling verwijderd:', data);
            return data;
        })
        .catch(error => {
            console.error('Fout bij verwijderen van bestelling:', error);
        });
}

const KLEUR_CODE   = { "Rood": 1, "Blauw": 2, "Groen": 3 };
const GEWICHT_CODE = { "Rood": 1, "Blauw": 2, "Groen": 3 }; // 1=15kg, 2=25kg, 3=50kg

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

const GEWICHTEN = {
    "Rood": 15,
    "Blauw": 25,
    "Groen": 50
};