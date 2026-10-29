from fastapi import FastAPI
import random
import uvicorn
from pydantic import BaseModel
from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import FileResponse, StreamingResponse
from pathlib import Path
import mysql.connector
import sys
import asyncio
import socket
import threading
import time
from pathlib import Path
import json
from weetniewatikdoe import FlexSimMonitor
app = FastAPI()
# True = FlexSim met venster. False = zonder venster (dan ook geen Chromium/GPU-foutmeldingen in de terminal).
SHOW_GUI = True

# Wanneer moet de simulatie stoppen? None = nooit (doorlopen tot Ctrl+C).
MAX_SIM_TIJD = None   # bv. 1114  -> stopt bij 1114 s simulatietijd
STOP_WHEN = None      # bv. lambda data: data["Truck1 ouput"]["in"] >= 100  (voorbeeld)

monitor = FlexSimMonitor(refresh=1.0, run_speed=15, show_gui=SHOW_GUI, max_sim_time=MAX_SIM_TIJD, stop_when=STOP_WHEN)


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
    WeightSorted: bool
    ColorSorted: bool
    IDPackage: int
    InWareHouse: bool
    Shipping: bool
    Done: bool
    WareHouseID: int | None = None

factorystatistics = ""

# Eerste bestelling
bestellingen = [
    Order(
        Color=random.randrange(1, 4),
        Weight=random.randrange(1, 4),
        ColorSorted=False,
        IDPackage=random.randrange(1, 99999),
        Done=False,
        WeightSorted=False,
        Shipping=False,
        InWareHouse=False,
        WareHouseID=None,
    )
]

orders_versie = 0   # gaat omhoog bij elke wijziging; de /events-stroom stuurt dan een update


def orders_gewijzigd():
    global orders_versie
    orders_versie += 1

def connectDB():
    db = mysql.connector.connect(
        host="127.0.0.1",
        port=3306,
        user="root",
        password="welkom",
        database="Packages",
    )
    cursor = db.cursor()
    return cursor, db


def DisconnectDB(cursor, db):
    cursor.close()
    db.close()

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
            if stil >= 15:                      # af en toe een levensteken, zodat de verbinding open blijft
                yield ": ping\n\n"
                stil = 0.0
            await asyncio.sleep(0.25)           # alleen een interne controle, geen netwerkverkeer

    return StreamingResponse(stroom(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.post("/factoryinput")
async def factoryinput(input: FactoryInput):
    """Zoals in je originele API. FlexSim stuurt nu niets meer; dit voorkomt alleen een 404."""
    return input


@app.post("/stop")
async def Stop():
    """Stopt FlexSim en sluit de API af (knop op /machines)."""
    alles_stoppen("stop gevraagd via de API")
    return {"status": "stoppen"}


@app.get("/machines")
async def Machines():
    return FileResponse(Path(__file__).parent / "machines.html")

@app.get("/Bestellingen")
async def ListBestelling():
    cursor, db = connectDB()
    cursor.execute("SELECT * FROM weights")
    rows = cursor.fetchall()

    for nr, (
        IDPackage,
        Color,
        ColorSorted,
        WeightSorted,
        InWareHouse,
        Shipping,
        Done,
        Weight,
        WareHouseID,
    ) in enumerate(rows, start=1):
        print(
            f"{nr:>3}  {IDPackage!s:<12} {Color!s:<15} "
            f"{ColorSorted!s:<15} {WeightSorted!s:<15} "
            f"{InWareHouse!s:<12} {Shipping!s:<10} "
            f"{Done!s:<6} {Weight!s:>8}"
            f"{WareHouseID!s:<12}"
        )
    DisconnectDB(cursor, db)
    bestellingen = PuteverythingInList()
    return bestellingen

@app.post("/NewBestelling")
async def AddBestelling(NieuwKleur: int, NieuwGewicht: int):
    if(CheckWarehouseEmpty()):
        
        cursor, db = connectDB()

        nieuwe_bestelling = Order(
            Color=NieuwKleur,
            Weight=NieuwGewicht,
            ColorSorted=False,
            IDPackage=random.randrange(1, 99999),
            Done=False,
            WeightSorted=False,
            Shipping=False,
            InWareHouse=False,
            WareHouseID=None,
        )
        bestellingen.append(nieuwe_bestelling)

        cursor.execute(
            """INSERT INTO weights
            (IDPackage, Color, ColorSorted, WeightSorted,
                InWareHouse, Shipping, Done, Weight, WarehouseID)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (
                0,
                nieuwe_bestelling.Color,
                nieuwe_bestelling.ColorSorted,
                nieuwe_bestelling.WeightSorted,
                nieuwe_bestelling.InWareHouse,
                nieuwe_bestelling.Shipping,
                nieuwe_bestelling.Done,
                nieuwe_bestelling.Weight,
                nieuwe_bestelling.WareHouseID,
            ),
        )
        db.commit()

        DisconnectDB(cursor, db)
    else:
        CheckFirstAvailable(NieuwKleur, NieuwGewicht)
        cursor, db = connectDB()
        nieuwe_bestelling = Order(
                    Color=NieuwKleur,
                    Weight=NieuwGewicht,
                    ColorSorted=True,
                    IDPackage=0,
                    Done=False,
                    WeightSorted=True,
                    Shipping=False,
                    InWareHouse=False,
                    WareHouseID=None,
                )
        cursor.execute(
            """INSERT INTO weights
            (IDPackage, Color, ColorSorted, WeightSorted,
                InWareHouse, Shipping, Done, Weight, WarehouseID)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (
                nieuwe_bestelling.IDPackage,
                nieuwe_bestelling.Color,
                nieuwe_bestelling.ColorSorted,
                nieuwe_bestelling.WeightSorted,
                nieuwe_bestelling.InWareHouse,
                nieuwe_bestelling.Shipping,
                nieuwe_bestelling.Done,
                nieuwe_bestelling.Weight,
                nieuwe_bestelling.WareHouseID,
            ),
        )
        db.commit()
        DisconnectDB(cursor, db)
    return bestellingen

@app.post("/ChangeValue")
async def ChangeValue(IDNumber: int, BoolChange: str):
    toegestaan = {"WeightSorted", "ColorSorted", "InWareHouse", "Shipping", "Done"}
    if BoolChange not in toegestaan:
        return "invalid option"
    cursor, db = connectDB()
    cursor.execute(
        f"UPDATE weights SET {BoolChange} = NOT {BoolChange} WHERE IDPackage = %s",
        (IDNumber,),
    )
    db.commit()
    DisconnectDB(cursor, db)
    PuteverythingInList()
    orders_gewijzigd()   # so the dashboard /events stream updates too
    return bestellingen

@app.post("/RemoveBestelling")
async def RemoveBestelling(IDNumber: int):
    cursor, db = connectDB()
    for bestelling in bestellingen:
        if bestelling.IDPackage == IDNumber:
            bestellingen.remove(bestelling)
            break

    cursor.execute(
        """
        DELETE FROM weights WHERE IDPACKAGE = %s;""",
        (IDNumber),
    )
    db.commit()
    DisconnectDB(cursor, db)
    return bestellingen

@app.post("/AddWarehouse")
async def AddToWarehouse(NewColor: int, NewWeight: int):
    cursor, db = connectDB()
    
    nieuwe_bestelling = Order(
        Color=NewColor,
        Weight=NewWeight,
        ColorSorted=True,
        IDPackage=None,
        Done=False,
        WeightSorted=False,
        Shipping=False,
        InWareHouse=True,
        WareHouseID=0
    )
    cursor.execute(
        """INSERT INTO Warehouse
        (IDPackage, Color, ColorSorted, WeightSorted,
            InWareHouse, Shipping, Done, Weight, WarehouseID)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (
            nieuwe_bestelling.IDPackage,
            nieuwe_bestelling.Color,
            nieuwe_bestelling.ColorSorted,
            nieuwe_bestelling.WeightSorted,
            nieuwe_bestelling.InWareHouse,
            nieuwe_bestelling.Shipping,
            nieuwe_bestelling.Done,
            nieuwe_bestelling.Weight,
            nieuwe_bestelling.WareHouseID,
        ),
    )
    db.commit()
    
    DisconnectDB(cursor, db)
    return 

async def CheckFirstAvailable(Color, Weight):
    cursor, db = connectDB()
    cursor.execute(
        """SELECT *
        FROM Warehouse w
        WHERE Color = %s AND Weight LIKE %s AND w.IDPackage IS NULL
        ORDER BY w.WarehouseID ASC
        LIMIT 1;""",
        (
            Color,
            Weight,
        )
    )
    result = cursor.fetchone()
    if result is None:
        return False
    else:
        WarehouseID = result[0]
        return WarehouseID


async def CheckWarehouseEmpty():
    cursor, db = connectDB()
    cursor.execute(
        """SELECT * FROM Warehouse"""
    )
    result = cursor.fetchone()
    if result is None:
        WarehouseEmpty = False
    if result is not None:
        WarehouseEmpty = True
    DisconnectDB(cursor, db)
    return WarehouseEmpty

# ---------- fabrieksdata: direct uit het geheugen, geen HTTP-hop ----------
@app.get("/factory")
async def Factory():
    """Volledige laatste meting als JSON (machines + samenvatting per stap)."""
    return monitor.snapshot()

@app.get("/stats")
async def Statistics():
    Red = 0
    Blue = 0
    Green = 0
    WeightOne = 0
    WeightTwo = 0
    WeightThree = 0
    cursor, db = connectDB()
    cursor.execute("SELECT * FROM weights")
    rows = cursor.fetchall()
    DBstats = ""

    for nr, (
        IDPackage,
        Color,
        ColorSorted,
        WeightSorted,
        InWareHouse,
        Shipping,
        Done,
        Weight,
    ) in enumerate(rows, start=1):
        print(
            f"{nr:>3}  {IDPackage!s:<12} {Color!s:<15} "
            f"{ColorSorted!s:<15} {WeightSorted!s:<15} "
            f"{InWareHouse!s:<12} {Shipping!s:<10} "
            f"{Done!s:<6} {Weight!s:>8}"
        )
        DBstats += (
            f"{nr:>3}  {IDPackage!s:<12} {Color!s:<15} "
            f"{ColorSorted!s:<15} {WeightSorted!s:<15} "
            f"{InWareHouse!s:<12} {Shipping!s:<10} "
            f"{Done!s:<6} {Weight!s:>8}"
        )
    DisconnectDB(cursor, db)
    bestellingen = PuteverythingInList()

    for bestelling in bestellingen:
        match bestelling.Color:
            case 1:
                Red += 1
            case 2:
                Blue += 1
            case 3:
                Green += 1
        match bestelling.Weight:
            case 1:
                WeightOne += 1
            case 2:
                WeightTwo += 1
            case 3:
                WeightThree += 1

    statistics = (
        "\n"
        + "RedPackages: "
        + str(Red)
        + "\n"
        + "Blue Packages: "
        + str(Blue)
        + "\n"
        + "Green Packages: "
        + str(Green)
        + "\n"
        + "5kg Packages: "
        + str(WeightOne)
        + "\n"
        + "10kg Packages: "
        + str(WeightTwo)
        + "\n"
        + "15kg Packages: "
        + str(WeightThree)
        + "\n"
        + factorystatistics
    )
    return statistics

def PuteverythingInList():
    bestellingen.clear()
    cursor, db = connectDB()
    cursor.execute("SELECT * FROM weights")
    rows = cursor.fetchall()

    for (
        IDPackage,
        Color,
        ColorSorted,
        WeightSorted,
        InWareHouse,
        Shipping,
        Done,
        Weight,
        WarehouseID,
    ) in rows:
        bestellingen.append(
            Order(
                Color=Color,
                Weight=Weight,
                IDPackage=IDPackage,
                ColorSorted=ColorSorted,
                WeightSorted=WeightSorted,
                InWareHouse=InWareHouse,
                Shipping=Shipping,
                Done=Done,
                WareHouseID=WarehouseID
            )
        )
    DisconnectDB(cursor, db)
    return bestellingen


def start_API():
    cursor, db = connectDB()
    cursor.execute("SELECT COUNT(*) FROM weights")
    count = cursor.fetchone()[0]

    # Only create 100 packages if the database is empty
    if count == 0:
        for i in range(100):
            cursor.execute(
                """INSERT INTO weights
                (Color, ColorSorted, WeightSorted,
                 InWareHouse, Shipping, Done, Weight)
                VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                (
                    random.randrange(1, 4),
                    False,
                    False,
                    False,
                    False,
                    False,
                    random.randrange(1, 4),
                ),
            )
            i += 1
        db.commit()

    PuteverythingInList()
    DisconnectDB(cursor, db)


@app.get("/REMOVE")
def DeleteDatabase():
    connection = mysql.connector.connect(
        host="127.0.0.1",
        port=3306,
        user="root",
        password="welkom",
        database="Packages",
    )

    try:
        with connection.cursor() as cursor:
            cursor.execute("TRUNCATE TABLE weights")
            cursor.execute("TRUNCATE TABLE Warehouse")
        connection.commit()
        return {"deleted": True}
    finally:
        connection.close()


start_API()
if __name__ == "__main__":
    # 0.0.0.0 = luistert op alle IP's van deze pc (nu 145.93.112.57), dus IP-wissels maken niet uit.
    # Draait er al een instantie? Dan niet nog een FlexSim starten.
    with socket.socket() as _s:
        if _s.connect_ex(("127.0.0.1", 8000)) == 0:
            sys.exit("[start] Poort 8000 is al in gebruik: er draait al een instantie. "
                     "Sluit die eerst af (Ctrl+C of python.exe/FlexSim in Taakbeheer).")

    config = uvicorn.Config(app, host="0.0.0.0", port=8000, log_level="info", access_log=False)
    server = uvicorn.Server(config)
    threading.Thread(target=server.run, name="api", daemon=True).start()
    threading.Thread(target=console_luisteraar, name="console", daemon=True).start()
    for _ in range(100):                      # wacht tot de API echt luistert (max 10 s)
        if server.started:
            break
        time.sleep(0.1)
    if server.started:
        print("[api] bereikbaar op http://145.93.112.57:8000  (machines: /machines)", flush=True)
        zelftest()
    else:
        print("[api] FOUT: de API is niet gestart (zie melding hierboven).", flush=True)
    print("[stop] Typ 'stop' + Enter, druk Ctrl+C of gebruik de knop op /machines om alles af te sluiten.",
          flush=True)
    try:
        monitor.run()          # blokkeert tot stop, Ctrl+C of stopvoorwaarde
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
    time.sleep(1)              # laat de API het antwoord nog versturen
    print("[stop] alles afgesloten", flush=True)