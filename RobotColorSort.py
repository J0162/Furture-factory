import random
import requests

bestellingen = []

def SortByRequestedType(current):
    response = requests.get("http://127.0.0.1:8000/Bestellingen")
    bestellingen = response.json()
    #print(bestellingen)
    
    if not bestellingen:
        print("bestellingen null")
        return random.randrange(1, 4)
    else:
        first_item = bestellingen[0]
        
        # Unwrap nested list structure if present (e.g., [{'Color': 2, ...}])
        if isinstance(first_item, list) and len(first_item) > 0:
            first_item = first_item[0]
            
        # Access key using dictionary bracket notation
        gekozen_kleur = first_item["Color"]
        
        requests.get("http://127.0.0.1:8000/RemoveBestelling")
        print(gekozen_kleur)
        return gekozen_kleur
