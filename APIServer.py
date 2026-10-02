from fastapi import FastAPI
import random
import uvicorn

app = FastAPI()
i = 1
bestellingen = []
while i < 10:
    bestellingen.append(random.randrange(1, 4))
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
    bestellingen.pop()
    return bestellingen


if __name__ == "__main__":
    # Run this directly from your normal terminal/command prompt (python APIServer.py)
    uvicorn.run("APIServer:app", host="127.0.0.1", port=8000, reload=True)