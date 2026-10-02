import random
import requests

bestellingen = []

def SortByRequestedType(current):
    response = requests.get("http://127.0.0.1:8000/Bestellingen")
    bestellingen = response.json()
    print(bestellingen)
    if not bestellingen:
        print("bestellingen null")
        return random.randrange(1, 4)
    else:
        gekozen_poort = bestellingen[-1]
        requests.get("http://127.0.0.1:8000/RemoveBestelling")
        print(gekozen_poort)
        return gekozen_poort
