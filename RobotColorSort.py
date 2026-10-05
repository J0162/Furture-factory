import random
import requests


class CurrentOrder:
    def __init__(self, IDPackage, Color):
        self.IDPackage = IDPackage
        self.Color = Color


RobotList = []


def SortByRequestedType(current):
    # Bestellingen ophalen
    response = requests.get("http://127.0.0.1:8000/Bestellingen")

    if response.status_code != 200:
        print("Fout bij ophalen bestellingen:", response.status_code)
        return random.randrange(1, 4)

    bestellingen = response.json()

    if not bestellingen:
        print("Geen bestellingen beschikbaar")
        return random.randrange(1, 4)

    RobotList.clear()

    # Door alle bestellingen lopen
    for bestelling in bestellingen:

        # Alleen bestellingen gebruiken die nog niet gesorteerd zijn
        if bestelling["ColorSorted"] is False:

            RobotList.append(
                CurrentOrder(
                    bestelling["IDPackage"],
                    bestelling["Color"]
                )
            )

    # Geen geschikte bestelling gevonden
    if not RobotList:
        print("Geen ongesorteerde bestelling gevonden")
        return random.randrange(1, 4)

    # Eerste geschikte bestelling pakken
    gekozen_bestelling = RobotList[0]

    gekozen_kleur = gekozen_bestelling.Color
    gekozen_id = gekozen_bestelling.IDPackage

    print("Gekozen bestelling:")
    print("ID:", gekozen_id)
    print("Kleur:", gekozen_kleur)

    # Bestelling verwijderen via ID
    response = requests.post(
        "http://127.0.0.1:8000/RemoveBestelling",
        params={"IDNumber": gekozen_id}
    )

    if response.status_code != 200:
        print("Fout bij verwijderen bestelling:", response.status_code)

    return gekozen_kleur
