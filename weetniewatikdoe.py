import os
import sys
import time
import json
import queue
import shutil
import threading
import urllib.request
from datetime import datetime, timezone

t0 = time.perf_counter()

scriptPath = os.path.dirname(os.path.realpath(__file__))
program = r"C:\Program Files\Autodesk\FlexSim 2027\program"
flexsimpy = r"C:\Program Files\Autodesk\FlexSim 2027\modules\FlexSimPy-main\out\Rel_3_10"
for p in (program, flexsimpy):
    os.add_dll_directory(p)
os.environ["PATH"] = program + os.pathsep + os.environ["PATH"]
sys.path.insert(0, flexsimpy)

import FlexSimPy

MODEL = os.path.join(scriptPath, "future factory.fsx")
REFRESH = 1.0
RUN_SPEED = 15     
API_URL = "http://127.0.0.1:8000/factoryinput"
API_KEY = ""   

STAPPEN = {
    "Vrachtwagens input": ["Truck1 ouput2", "Truck1 ouput1"],
    "Import queue": ["import_1", "import_2"],
    "Heftruck naar inkomst rack": ["Transporter1", "Transporter2"],
    "Drive-in racken begin": ["DriveInRack1"],
    "Heftruck begin fabriekproces": ["Transporter3"],
    "Begin fabriekproces": ["Separator1"],
    "Wegen": ["Processor1", "Processor2"],
    "Sorters": ["Processor3", "Processor4", "Processor5"],
    "Robotarmen": ["Robot1", "Robot2", "Robot3"],
    "Ververs": ["Processor10", "Processor11", "Processor12", "Processor16", "Processor17",
                "Processor18", "Processor22", "Processor23", "Processor24"],
    "Doos inpakkers": ["Processor13", "Processor14", "Processor15", "Processor19", "Processor20",
                       "Processor21", "Processor25", "Processor26", "Processor27"],
    "Pallet inpakkers": ["Processor28", "Processor29", "Processor30", "Processor31", "Processor32",
                         "Processor33", "Processor36", "Processor34", "Processor35"],
    "Queue object 1": ["object 1_1", "object 1_2", "object 1_3"],
    "Queue object 2": ["object 2_1", "object 2_2", "object 2_3"],
    "Queue object 3": ["object 3_1", "object 3_2", "object 3_3"],
    "Heftruck naar warehouse": ["Transporter obj 3", "Transporter obj3", "Transporter obj 2",
                                "transporter obj1", "Transporter obj2", "Transporter obj1"],
    "Drive-in racken warenhuis": ["warehose rack1", "warehose rack2", "warehose rack3"],
    "Heftruck export": ["export1", "export2"],
    "Export queue": ["export 2", "export 1"],
    "Export truck / output": ["Truck1 ouput", "Truck2 output"],
}
ONDERDELEN = {}
for stap, namen in STAPPEN.items():
    for n in namen:
        ONDERDELEN.setdefault(n, stap)


PM_NAAM = "monitor"
KEYS = ["in", "uit", "inhoud", "gem_tijd"]
INFO = ["nog niet gemeten"]


def meet(controller, keuze=None):
    """Leest de measure uit en zet de tekst 'naam;in;uit;inhoud;gem|naam;...' om naar een dict."""
    try:
        raw = controller.getPerformanceMeasure(PM_NAAM)
    except Exception as e:
        INFO[0] = f"FOUT bij getPerformanceMeasure('{PM_NAAM}'): {type(e).__name__}: {e}"
        return {}
    if not isinstance(raw, str):
        INFO[0] = f"Measure '{PM_NAAM}' gaf {type(raw).__name__} terug ({raw!r}); er moet tekst terugkomen"
        return {}
    data = {}
    for deel in raw.split("|"):
        v = deel.split(";")
        if len(v) == 5:
            try:
                data[v[0]] = {k: (float(x) if x != "" else None) for k, x in zip(KEYS, v[1:])}
            except ValueError:
                pass
    INFO[0] = f"Measure '{PM_NAAM}' ok: {len(data)} van {len(ONDERDELEN)} onderdelen"
    return data


# ---------- API ----------
verstuur_queue = queue.Queue(maxsize=1)
API_STATUS = ["nog niets verstuurd"]


def stuur_worker():
    while True:
        payload = verstuur_queue.get()
        try:
            headers = {"Content-Type": "application/json"}
            if API_KEY:
                headers["Authorization"] = f"Bearer {API_KEY}"
            req = urllib.request.Request(API_URL, data=json.dumps(payload).encode("utf-8"), method="POST", headers=headers)
            with urllib.request.urlopen(req, timeout=5) as r:
                API_STATUS[0] = f"API ok ({r.status}) {datetime.now().strftime('%H:%M:%S')}"
        except Exception as e:
            API_STATUS[0] = f"API fout: {type(e).__name__}: {e}"


def stuur(payload):
    """Verstuurt op de achtergrond; is de API traag, dan wordt de oudste meting overgeslagen."""
    try:
        verstuur_queue.put_nowait(payload)
    except queue.Full:
        try:
            verstuur_queue.get_nowait()
        except queue.Empty:
            pass
        verstuur_queue.put_nowait(payload)


def maak_payload(run_id, status, simtijd, echt, data):
    return {
        "run_id": run_id,
        "status": status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "sim_time": simtijd,
        "real_time": echt,
        "script_runtime": time.perf_counter() - t0,
        "machines": [
            {"stap": stap, "naam": naam, **data.get(naam, {k: None for k in KEYS})}
            for naam, stap in ONDERDELEN.items()
        ],
    }


def fmt(v, d=0):
    return "-" if v is None else f"{v:.{d}f}"


def regels_detail(data):
    r = [f"{'Stap':<28}{'Naam':<20}{'In':>7}{'Uit':>7}{'Nu':>6}{'Gem. tijd (s)':>15}", "-" * 83]
    vorige = None
    for naam, stap in ONDERDELEN.items():
        d = data.get(naam, {})
        label = stap if stap != vorige else ""
        vorige = stap
        r.append(f"{label:<28}{naam:<20}{fmt(d.get('in')):>7}{fmt(d.get('uit')):>7}{fmt(d.get('inhoud')):>6}{fmt(d.get('gem_tijd'), 2):>15}")
    return r


def regels_samenvatting(data):
    r = [f"{'Stap':<30}{'Machines':>9}{'In':>8}{'Uit':>8}{'Nu':>7}{'Gem. tijd (s)':>15}", "-" * 77]
    for stap, namen in STAPPEN.items():
        ds = [data.get(n, {}) for n in namen]
        def som(k):
            w = [d[k] for d in ds if d.get(k) is not None]
            return sum(w) if w else None
        t = [d["gem_tijd"] for d in ds if d.get("gem_tijd") is not None]
        r.append(f"{stap:<30}{len(namen):>9}{fmt(som('in')):>8}{fmt(som('uit')):>8}{fmt(som('inhoud')):>7}{fmt(sum(t) / len(t) if t else None, 2):>15}")
    return r


def scherm(data, simtijd, echt, meetduur, hoogte):
    kop = ["FUTURE FACTORY MONITOR",
           f"Sim-tijd: {simtijd:10.1f} s | echte tijd: {echt:9.2f} s | meetduur: {meetduur:.2f} s | Enter = stoppen", f"API: {API_STATUS[0]}", ""]
    voet = ["", INFO[0]]
    detail = regels_detail(data)
    if len(kop) + len(detail) + len(voet) <= hoogte:
        return kop + detail + voet
    samen = kop + regels_samenvatting(data) + ["(maak het terminalpaneel hoger voor alle machines)"]
    return samen[:hoogte - len(voet)] + voet


def teken(regels):
    size = shutil.get_terminal_size((120, 40))
    regels = [r[:size.columns - 1] for r in regels[:size.lines - 1]]
    sys.stdout.write("\033[H" + "\033[K\n".join(regels) + "\033[K\033[J")
    sys.stdout.flush()


os.system("")  # ANSI-codes aan in Windows

print("Launching...", flush=True)
controller = FlexSimPy.launch(evaluationLicense=False, showGUI=True, programDir=program + "\\")
controller.open(MODEL)
controller.reset()
controller.runToTime(10)                
print("Measure testen...", flush=True)
keuze = None
if not meet(controller):
    print(INFO[0], flush=True)
    print("\nDe measure geeft nog geen data. Maak hem eerst aan in FlexSim (zie uitleg) of stuur de regel hierboven door.")
    input("Enter om toch door te gaan of Ctrl+C om te stoppen...")
print(INFO[0], flush=True)

threading.Thread(target=stuur_worker, daemon=True).start()
run_id = datetime.now().strftime("%Y%m%d-%H%M%S")

stop = threading.Event()
threading.Thread(target=lambda: (input(), stop.set()), daemon=True).start()

t_run = time.perf_counter()
controller.run(RUN_SPEED)

sys.stdout.write("\033[?1049h\033[2J")   
try:
    while not stop.is_set():
        t1 = time.perf_counter()
        data = meet(controller, keuze)
        duur = time.perf_counter() - t1
        simtijd = controller.time()
        echt = time.perf_counter() - t_run
        if data:
            stuur(maak_payload(run_id, "running", simtijd, echt, data))
        else:
            API_STATUS[0] = "niets verstuurd: de measure geeft geen data"
        hoogte = shutil.get_terminal_size((120, 40)).lines - 1
        teken(scherm(data, simtijd, echt, duur, hoogte))
        time.sleep(REFRESH)
finally:
    sys.stdout.write("\033[?1049l")
    sys.stdout.flush()

controller.stop()
data = meet(controller, keuze)
if data:
    stuur(maak_payload(run_id, "stopped", controller.time(), time.perf_counter() - t_run, data))
    time.sleep(1.5)  
print("\n".join(regels_detail(data)))
print("\n" + INFO[0])
print(API_STATUS[0])
print(f"Sim-tijd: {controller.time():.1f} s | run-tijd: {time.perf_counter() - t_run:.2f} s | totale runtime script: {time.perf_counter() - t0:.2f} s")
input("Klaar - FlexSim blijft open tot je op Enter drukt...")