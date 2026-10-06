# Dashboard server.
# This file keeps NO list of its own. Every request is passed through to
# APIServer.py (the real server FlexSim uses), so the dashboard always shows
# the live list from there.
#
# 1. Start APIServer.py           -> http://127.0.0.1:8000
# 2. Start this file              -> http://127.0.0.1:8080
# 3. Open http://127.0.0.1:8080/ in your browser

from pathlib import Path

import requests
import uvicorn
from fastapi import FastAPI, Response
from fastapi.responses import FileResponse

API_SERVER = "http://127.0.0.1:8000"   # where APIServer.py runs

app = FastAPI()


def doorsturen(method, path, params=None):
    """Send the request on to APIServer.py and return its answer unchanged."""
    try:
        r = requests.request(method, API_SERVER + path, params=params, timeout=3)
        return Response(content=r.content, status_code=r.status_code,
                        media_type=r.headers.get("content-type", "application/json"))
    except requests.exceptions.ConnectionError:
        return Response(content='{"detail": "APIServer.py draait niet op ' + API_SERVER + '"}',
                        status_code=503, media_type="application/json")


@app.get("/Bestellingen")
def ListBestelling():
    return doorsturen("GET", "/Bestellingen")


@app.post("/NewBestelling")
def AddBestelling(NieuwKleur: int, NieuwGewicht: int):
    return doorsturen("POST", "/NewBestelling",
                      {"NieuwKleur": NieuwKleur, "NieuwGewicht": NieuwGewicht})


@app.get("/")
def Dashboard():
    return FileResponse(Path(__file__).parent / "dashboard.html")


if __name__ == "__main__":
    uvicorn.run("TESTAPIServer_dashboard:app", host="127.0.0.1", port=8080, reload=True)
