from fastapi import FastAPI
import random
import uvicorn
from pydantic import BaseModel


class Order(BaseModel):
    Color: int
    Weight: int
    ColorSorted: bool
    IDPackage: int


app = FastAPI()


# Eerste bestelling
bestellingen = [
    Order(
        Color=random.randrange(1, 4),
        Weight=random.randrange(1, 4),
        ColorSorted=False,
        IDPackage=random.randrange(1, 99999)
    )
]

# Nog 99 bestellingen toevoegen
i = 1

while i < 100:
    bestellingen.append(
        Order(
            Color=random.randrange(1, 4),
            Weight=random.randrange(1, 4),
            ColorSorted=False,
            IDPackage=random.randrange(1, 99999)
        )
    )
    i += 1


@app.get("/Bestellingen")
async def ListBestelling():
    return bestellingen


@app.post("/NewBestelling")
async def AddBestelling(NieuwKleur: int, NieuwGewicht: int):

    nieuwe_bestelling = Order(
        Color=NieuwKleur,
        Gewicht=NieuwGewicht,
        ColorSorted=False,
        IDPackage=random.randrange(1, 99999)
    )

    bestellingen.append(nieuwe_bestelling)

    return bestellingen


@app.post("/ColorSet")
async def ColorSet(IDNumber: int):

    for bestelling in bestellingen:
        if bestelling.IDPackage == IDNumber:
            bestelling.ColorSorted = True
            break

    return bestellingen


@app.post("/RemoveBestelling")
async def RemoveBestelling(IDNumber: int):

    for bestelling in bestellingen:
        if bestelling.IDPackage == IDNumber:
            bestellingen.remove(bestelling)
            break

    return bestellingen


if __name__ == "__main__":
    uvicorn.run(
        "APIServer:app",
        host="127.0.0.1",
        port=8000,
        reload=True
    )
