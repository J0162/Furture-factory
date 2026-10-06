from dataclasses import dataclass
from pathlib import Path
import random

from fastapi import FastAPI
from fastapi.responses import FileResponse
import uvicorn

app = FastAPI()


@dataclass
class Order:
    Color: int
    Weight: int
    ColorSorted: bool = False


def random_order():
    return Order(Color=random.randrange(1, 4), Weight=random.randrange(1, 4))


# 100 random orders (flat list of Order objects, no nested lists)
bestellingen = [random_order() for _ in range(100)]

# Simple counters so the dashboard can show throughput
stats = {"verwerkt": 0, "toegevoegd": 0}


@app.get("/Bestellingen")
async def ListBestelling():
    return bestellingen


@app.post("/NewBestelling")
async def AddBestelling(Color: int, Weight: int = 1):
    bestellingen.append(Order(Color=Color, Weight=Weight))
    stats["toegevoegd"] += 1
    return bestellingen


@app.get("/RemoveBestelling")
async def RemoveBestelling():
    if bestellingen:
        bestellingen.pop(0)
        stats["verwerkt"] += 1
    return bestellingen


@app.get("/Stats")
async def Stats():
    return {**stats, "in_wachtrij": len(bestellingen)}


# Live dashboard: open http://127.0.0.1:8000/ in your browser
@app.get("/")
async def Dashboard():
    return FileResponse(Path(__file__).parent / "dashboard.html")


if __name__ == "__main__":
    uvicorn.run("TESTAPIServer_dashboard:app", host="127.0.0.1", port=8080, reload=True)
