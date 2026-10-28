from fastapi import FastAPI
import random
import uvicorn
from pydantic import BaseModel
from fastapi.responses import FileResponse
from pathlib import Path
import mysql.connector

# db = mysql.connector.connect(
#    host="localhost",
#    port=3306,
#    user="root",
#    password="welkom",
#    database="Packages",
# )

# cursor = db.cursor()

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

app = FastAPI()

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
    )
]

# Nog 99 bestellingen toevoegen
# i = 1

# while i < 100:
#    bestellingen.append(
#        Order(
#            Color=random.randrange(1, 4),
#            Weight=random.randrange(1, 4),
#            ColorSorted=False,
#            IDPackage=random.randrange(1, 99999),
#            Done=False,
#            WeightSorted=False,
#            Shipping=False,
#            InWareHouse=False
#        )
#    )
#    i += 1

def connectDB():
    db = mysql.connector.connect(
        host="localhost",
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
    ) in enumerate(rows, start=1):
        print(
            f"{nr:>3}  {IDPackage!s:<12} {Color!s:<15} "
            f"{ColorSorted!s:<15} {WeightSorted!s:<15} "
            f"{InWareHouse!s:<12} {Shipping!s:<10} "
            f"{Done!s:<6} {Weight!s:>8}"
        )
    DisconnectDB(cursor, db)
    bestellingen = PuteverythingInList()
    return bestellingen

@app.get("/")
async def Dashboard():
    return FileResponse(Path(__file__).parent / "dashboard.html")

@app.post("/NewBestelling")
async def AddBestelling(NieuwKleur: int, NieuwGewicht: int):
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
    )
    bestellingen.append(nieuwe_bestelling)

    cursor.execute(
        """INSERT INTO weights
        (IDPackage, Color, ColorSorted, WeightSorted,
            InWareHouse, Shipping, Done, Weight)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
        (
            0,
            nieuwe_bestelling.Color,
            nieuwe_bestelling.ColorSorted,
            nieuwe_bestelling.WeightSorted,
            nieuwe_bestelling.InWareHouse,
            nieuwe_bestelling.Shipping,
            nieuwe_bestelling.Done,
            nieuwe_bestelling.Weight,
        ),
    )
    db.commit()

    DisconnectDB(cursor, db)
    return bestellingen

@app.post("/factoryinput")
async def factoryinput(input: FactoryInput):
    input == factorystatistics
    return input

@app.post("/ChangeValue")
async def ColorSet(IDNumber: int, BoolChange: str):
    for bestelling in bestellingen:
        if bestelling.IDPackage == IDNumber:
            if BoolChange == "WeightSorted":
                bestelling.WeightSorted = not bestelling.WeightSorted
            elif BoolChange == "ColorSorted":
                bestelling.ColorSorted = not bestelling.ColorSorted
            elif BoolChange == "InWareHouse":
                bestelling.InWareHouse = not bestelling.InWareHouse
            elif BoolChange == "Shipping":
                bestelling.Shipping = not bestelling.Shipping
            elif BoolChange == "Done":
                bestelling.Done = not bestelling.Done
            break

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
        host="localhost",
        port=3306,
        user="root",
        password="welkom",
        database="Packages",
    )

    try:
        with connection.cursor() as cursor:
            cursor.execute("TRUNCATE TABLE weights")
        return {"deleted": True}
    finally:
        connection.close()

start_API()
if __name__ == "__main__":
    uvicorn.run("APIServer:app", host="127.0.0.1", port=8000, reload=True)
