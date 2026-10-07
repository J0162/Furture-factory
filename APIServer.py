from fastapi import FastAPI
import random
import uvicorn
from pydantic import BaseModel
from fastapi.responses import FileResponse
from pathlib import Path

class FactoryInput(BaseModel):
    run_id: str
    status: str
    timestamp: str
    sim_time: float
    real_time: float
    script_runtime: float
    machines: list

class Order(BaseModel):
    Color: int
    Weight: int
    ColorSorted: bool
    IDPackage: int
    Done: bool


app = FastAPI()

factorystatistics = ""

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

@app.post("/factoryinput")
async def factoryinput(input: FactoryInput):
    input == factorystatistics
    return input
    


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

@app.get("/stats")
async def Statistics():
    Red = 0
    Blue = 0
    Green = 0
    WeightOne = 0
    WeightTwo = 0
    WeightThree = 0
    for bestelling in bestellingen:
        match bestelling.Color:
            case 1:
                Red += 1
            case 2:
                Blue +=1
            case 3:
                Green += 1
        match bestelling.Weight:
            case 1:
                WeightOne += 1
            case 2:
                WeightTwo += 1
            case 3:
                WeightThree += 1

        


    statistics = str(bestellingen) + "\n" + "RedPackages: " + str(Red) + "\n" + "Blue Packages: " + str(Blue) + "\n" + "Green Packages: " + str(Green) + "\n" + "5kg Packages: " + str(WeightOne) + "\n" + "10kg Packages: " + str(WeightTwo) + "\n" + "15kg Packages: " + str(WeightThree) + "\n" + factorystatistics
    return statistics


if __name__ == "__main__":
    uvicorn.run(
        "APIServer:app",
        host="127.0.0.1",
        port=8000,
        reload=True
    )
