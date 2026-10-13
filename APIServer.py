
import os
import subprocess
import sys

if sys.version_info[:2] != (3, 10):
    print(f"[start] Python {sys.version_info[0]}.{sys.version_info[1]} gevonden, opnieuw starten met Python 3.10...",
          flush=True)
    try:
        sys.exit(subprocess.call(["py", "-3.10", os.path.abspath(__file__)] + sys.argv[1:]))
    except FileNotFoundError:
        sys.exit("Python launcher 'py' niet gevonden. Installeer Python 3.10 (python.org) met de py-launcher.")
    except KeyboardInterrupt:
        sys.exit(0)


import importlib.util

_ontbreekt = [m for m in ("fastapi", "uvicorn") if importlib.util.find_spec(m) is None]
if _ontbreekt:
    print(f"[start] {', '.join(_ontbreekt)} ontbreekt in Python 3.10, installeren...", flush=True)
    subprocess.check_call([sys.executable, "-m", "pip", "install", *_ontbreekt])


from weetniewatikdoe import FlexSimMonitor

import asyncio
import socket
import threading
import time
from pathlib import Path
import json
import random

import uvicorn
from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel


SHOW_GUI = True


MAX_SIM_TIJD = None   
STOP_WHEN = None      

monitor = FlexSimMonitor(refresh=1.0, run_speed=15, show_gui=SHOW_GUI,
                         max_sim_time=MAX_SIM_TIJD, stop_when=STOP_WHEN)


STOP_ALLES = threading.Event()


def alles_stoppen(reden):
    """Stopt de simulatie en sluit daarna het hele programma af."""
    print(f"[stop] {reden}", flush=True)
    STOP_ALLES.set()
    monitor.stop()


def zelftest():
    """Controleert direct na het opstarten of bestellingen en dashboard werken."""
    import urllib.request
    try:
        with urllib.request.urlopen("http://127.0.0.1:8000/Bestellingen", timeout=3) as r:
            n = len(json.loads(r.read()))
        print(f"[api] OK: /Bestellingen geeft {n} bestellingen", flush=True)
    except Exception as e:
        print(f"[api] FOUT bij /Bestellingen: {type(e).__name__}: {e}", flush=True)
    dash = Path(__file__).parent / "dashboard.html"
    if dash.exists():
        print("[api] OK: dashboard.html gevonden", flush=True)
    else:
        print(f"[api] FOUT: {dash} ontbreekt, de pagina op / werkt dan niet", flush=True)


def console_luisteraar():
    """Typ 'stop' + Enter in de terminal om alles af te sluiten."""
    while not STOP_ALLES.is_set():
        try:
            regel = input()
        except EOFError:
            return
        if regel.strip().lower() in ("stop", "q", "quit", "exit"):
            alles_stoppen("stop gevraagd in de terminal")
            return


app = FastAPI()

class Order(BaseModel):
    Color: int
    Weight: int
    ColorSorted: bool
    IDPackage: int
    Done: bool


def nieuwe_order(kleur=None, gewicht=None) -> Order:
    return Order(
        Color=kleur if kleur is not None else random.randrange(1, 4),
        Weight=gewicht if gewicht is not None else random.randrange(1, 4),
        ColorSorted=False,
        IDPackage=random.randrange(1, 99999),
        Done=False,
    )


bestellingen = [nieuwe_order() for _ in range(100)]

orders_versie = 0   


def orders_gewijzigd():
    global orders_versie
    orders_versie += 1


@app.get("/")
async def Dashboard():
    return FileResponse(Path(__file__).parent / "dashboard.html")


@app.get("/events")
async def Events(request: Request, kanalen: str = "orders,factory"):
    """Server-Sent Events: de server stuurt alleen als er iets verandert, de pagina hoeft niet te vragen."""
    gewenst = set(kanalen.split(","))

    async def stroom():
        laatste_orders = -1
        laatste_snap = None
        stil = 0.0
        while not await request.is_disconnected():
            verstuurd = False
            if "orders" in gewenst and orders_versie != laatste_orders:
                laatste_orders = orders_versie
                yield f"event: orders\ndata: {json.dumps(jsonable_encoder(bestellingen))}\n\n"
                verstuurd = True
            if "factory" in gewenst:
                snap = monitor.snapshot()
                if snap is not laatste_snap:
                    laatste_snap = snap
                    yield f"event: factory\ndata: {json.dumps(snap)}\n\n"
                    verstuurd = True
            stil = 0.0 if verstuurd else stil + 0.25
            if stil >= 15:                    
                yield ": ping\n\n"
                stil = 0.0
            await asyncio.sleep(0.25)          

    return StreamingResponse(stroom(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


class FactoryInput(BaseModel):
    run_id: str
    status: str
    timestamp: str
    sim_time: float
    real_time: float
    script_runtime: float
    machines: list


@app.post("/factoryinput")
async def factoryinput(input: FactoryInput):
    input == factorystatistics
    print(input)

@app.post("/stop")
async def Stop():
    """Stopt FlexSim en sluit de API af (knop op /machines)."""
    alles_stoppen("stop gevraagd via de API")
    return {"status": "stoppen"}


@app.get("/machines")
async def Machines():
    return FileResponse(Path(__file__).parent / "machines.html")


@app.get("/Bestellingen")
@app.get("/bestellingen")
async def ListBestelling():
    return bestellingen


@app.post("/NewBestelling")
@app.post("/newbestelling")
async def AddBestelling(NieuwKleur: int, NieuwGewicht: int):
    bestellingen.append(nieuwe_order(NieuwKleur, NieuwGewicht))
    orders_gewijzigd()
    return bestellingen


@app.post("/ColorSet")
@app.post("/colorset")
async def ColorSet(IDNumber: int):
    for bestelling in bestellingen:
        if bestelling.IDPackage == IDNumber:
            bestelling.ColorSorted = True
            break
    orders_gewijzigd()
    return bestellingen


@app.post("/RemoveBestelling")
@app.post("/removebestelling")
async def RemoveBestelling(IDNumber: int):
    for bestelling in bestellingen:
        if bestelling.IDPackage == IDNumber:
            bestellingen.remove(bestelling)
            break
    orders_gewijzigd()
    return bestellingen


@app.get("/factory")
async def Factory():
    """Volledige laatste meting als JSON (machines + samenvatting per stap)."""
    return monitor.snapshot()


@app.get("/stats")
async def Statistics():
    kleuren = {1: 0, 2: 0, 3: 0}
    gewichten = {1: 0, 2: 0, 3: 0}
    for b in bestellingen:
        kleuren[b.Color] = kleuren.get(b.Color, 0) + 1
        gewichten[b.Weight] = gewichten.get(b.Weight, 0) + 1

    return (
        str(bestellingen) + "\n"
        + f"RedPackages: {kleuren[1]}\n"
        + f"Blue Packages: {kleuren[2]}\n"
        + f"Green Packages: {kleuren[3]}\n"
        + f"5kg Packages: {gewichten[1]}\n"
        + f"10kg Packages: {gewichten[2]}\n"
        + f"15kg Packages: {gewichten[3]}\n"
        + json.dumps(monitor.snapshot())
    )


if __name__ == "__main__":
    with socket.socket() as _s:
        if _s.connect_ex(("127.0.0.1", 8000)) == 0:
            sys.exit("[start] Poort 8000 is al in gebruik: er draait al een instantie. "
                     "Sluit die eerst af (Ctrl+C of python.exe/FlexSim in Taakbeheer).")

    config = uvicorn.Config(app, host="0.0.0.0", port=8000, log_level="info", access_log=False)
    server = uvicorn.Server(config)
    threading.Thread(target=server.run, name="api", daemon=True).start()
    threading.Thread(target=console_luisteraar, name="console", daemon=True).start()
    for _ in range(100):                     
        if server.started:
            break
        time.sleep(0.1)
    if server.started:
        print("[api] bereikbaar op http://145.93.112.60:8000  (machines: /machines)", flush=True)
        zelftest()
    else:
        print("[api] FOUT: de API is niet gestart (zie melding hierboven).", flush=True)
    print("[stop] Typ 'stop' + Enter, druk Ctrl+C of gebruik de knop op /machines om alles af te sluiten.",
          flush=True)
    try:
        monitor.run()         
    except KeyboardInterrupt:
        STOP_ALLES.set()

    status = monitor.snapshot()["status"]
    if status in ("error", "finished") and not STOP_ALLES.is_set():
        if status == "error":
            print("\n[flexsim] gestopt door een fout (zie hierboven).", flush=True)
        else:
            print("\n[flexsim] simulatie klaar, laatste meting blijft beschikbaar.", flush=True)
        print("De API blijft draaien. Typ 'stop' + Enter of druk Ctrl+C om af te sluiten.", flush=True)
        try:
            while not STOP_ALLES.is_set():
                time.sleep(0.5)
        except KeyboardInterrupt:
            pass

    monitor.stop()
    server.should_exit = True
    time.sleep(1)             
    print("[stop] alles afgesloten", flush=True)