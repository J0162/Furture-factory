from fastapi import FastAPI
import random
import uvicorn
from pydantic import BaseModel
from fastapi.responses import FileResponse
from pathlib import Path



class Order(BaseModel):
    Color: int
    Weight: int
    ColorSorted: bool
    IDPackage: int
    Done: bool


app = FastAPI()


# Eerste bestelling
bestellingen = [
    Order(
        Color=random.randrange(1, 4),
        Weight=random.randrange(1, 4),
        ColorSorted=False,
        IDPackage=random.randrange(1, 99999),
        Done=False
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
            IDPackage=random.randrange(1, 99999),
            Done=False
        )
    )
    i += 1


@app.get("/Bestellingen")
async def ListBestelling():
    return bestellingen

@app.get("/")
async def Dashboard():
    return FileResponse(Path(__file__).parent / "dashboard.html")

@app.post("/NewBestelling")
async def AddBestelling(NieuwKleur: int, NieuwGewicht: int):

    nieuwe_bestelling = Order(
        Color=NieuwKleur,
        Weight=NieuwGewicht,
        ColorSorted=False,
        IDPackage=random.randrange(1, 99999),
        Done=False
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
