from fastapi import FastAPI
import random
import uvicorn

app = FastAPI()

class Order:
    def __init__(self, Color, Weight):
        self.Color = Color
        self.ColorSorted = ColorSorted
        self.Weight = Weight


i = 1
bestellingen = [Order(Color, Weight) for Color, Weight in [(random.randrange(1, 4), random.randrange(1, 4), False)]]
while i < 100:
    bestellingen.append([Order(random.randrange(1, 4), random.randrange(1, 4), False)])
    i += 1

@app.get("/Bestellingen")
async def ListBestelling():
    return bestellingen

@app.post("/NewBestelling")
async def AddBestelling(NieuwNummer: int):
    bestellingen.append(NieuwNummer)
    return bestellingen

@app.get("/RemoveBestelling")
async def RemoveBestelling():
    bestellingen.pop(0)
    return bestellingen


if __name__ == "__main__":
    # Run this directly from your normal terminal/command prompt (python APIServer.py)
    uvicorn.run("APIServer:app", host="127.0.0.1", port=8000, reload=True)