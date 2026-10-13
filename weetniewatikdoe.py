"""FlexSim-monitor als module: draait FlexSim in een eigen thread en bewaart
de laatste meting in het geheugen. De API leest die direct uit (geen HTTP nodig)."""
import os
import sys
import time
import threading
import traceback
from datetime import datetime, timezone

PROGRAM = r"C:\Program Files\Autodesk\FlexSim 2027\program"
FLEXSIMPY = r"C:\Program Files\Autodesk\FlexSim 2027\modules\FlexSimPy-main\out\Rel_3_10"
MODEL = os.path.join(os.path.dirname(os.path.realpath(__file__)), "future factory.fsx")

PM_NAAM = "monitor"
KEYS = ["in", "uit", "inhoud", "gem_tijd"]

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
for _stap, _namen in STAPPEN.items():
    for _n in _namen:
        ONDERDELEN.setdefault(_n, _stap)


FlexSimPy = None
IMPORT_FOUT = None
try:
    os.add_dll_directory(PROGRAM)
    os.add_dll_directory(FLEXSIMPY)
    os.environ["PATH"] = PROGRAM + os.pathsep + os.environ["PATH"]
    sys.path.insert(0, FLEXSIMPY)
    import FlexSimPy
except BaseException:
    IMPORT_FOUT = (f"Python: {sys.version}\nProgramma: {sys.executable}\n"
                   f"(FlexSimPy is gebouwd voor Python 3.10)\n\n" + traceback.format_exc())

_LEEG = {k: None for k in KEYS}


class FlexSimMonitor:
    def __init__(self, model=MODEL, refresh=1.0, run_speed=15, show_gui=True, verbose=False,
                 max_sim_time=None, stop_when=None):
        self.model = model
        self.refresh = refresh
        self.run_speed = run_speed
        self.show_gui = show_gui 
        self.verbose = verbose
        self.max_sim_time = max_sim_time   
        self.stop_when = stop_when        

        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._thread = None
        self._t0 = time.perf_counter()
        self._run_id = datetime.now().strftime("%Y%m%d-%H%M%S")
        self._snapshot = self._maak_snapshot("idle", 0.0, 0.0, {}, "nog niet gestart")

    def start(self):
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self.run, name="flexsim", daemon=True)
        self._thread.start()

    def stop(self):
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=15)

    def snapshot(self):
        """Laatste meting (thread-safe). Wordt alleen vervangen, nooit aangepast."""
        with self._lock:
            return self._snapshot

   
    def _maak_snapshot(self, status, simtijd, echt, data, info):
        machines = [
            {"stap": stap, "naam": naam, **data.get(naam, _LEEG)}
            for naam, stap in ONDERDELEN.items()
        ]
        return {
            "run_id": self._run_id,
            "status": status,
            "info": info,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "sim_time": simtijd,
            "real_time": echt,
            "script_runtime": time.perf_counter() - self._t0,
            "machines": machines,
            "stappen": self._samenvatting(data),
        }

    @staticmethod
    def _samenvatting(data):
        out = {}
        for stap, namen in STAPPEN.items():
            ds = [data.get(n, {}) for n in namen]

            def som(k):
                w = [d[k] for d in ds if d.get(k) is not None]
                return sum(w) if w else None

            t = [d["gem_tijd"] for d in ds if d.get("gem_tijd") is not None]
            out[stap] = {
                "machines": len(namen),
                "in": som("in"),
                "uit": som("uit"),
                "inhoud": som("inhoud"),
                "gem_tijd": sum(t) / len(t) if t else None,
            }
        return out

    @staticmethod
    def _meet(controller):
        """Leest de performance measure en zet 'naam;in;uit;inhoud;gem|naam;...' om naar een dict."""
        raw = controller.getPerformanceMeasure(PM_NAAM)
        if not isinstance(raw, str):
            raise TypeError(f"Measure '{PM_NAAM}' gaf {type(raw).__name__} terug, verwacht tekst")
        data = {}
        for deel in raw.split("|"):
            v = deel.split(";")
            if len(v) == 5:
                try:
                    data[v[0]] = {k: (float(x) if x != "" else None) for k, x in zip(KEYS, v[1:])}
                except ValueError:
                    pass
        return data

    def _set(self, snap):
        with self._lock:
            self._snapshot = snap

    def run(self):
        """Blokkerend: draai dit op de HOOFDTHREAD (zoals je oude script)."""
        controller = None
        try:
            if FlexSimPy is None:
                raise ImportError("FlexSimPy kon niet geladen worden:\n" + (IMPORT_FOUT or ""))
            if not os.path.exists(self.model):
                raise FileNotFoundError(f"Model niet gevonden: {self.model}")

            print("[flexsim] starten...", flush=True)
            self._set(self._maak_snapshot("starting", 0.0, 0.0, {}, "FlexSim wordt gestart"))
            controller = FlexSimPy.launch(evaluationLicense=False, showGUI=self.show_gui,
                                          programDir=PROGRAM + "\\")
            controller.open(self.model)
            controller.reset()
            controller.runToTime(10)
            controller.run(self.run_speed)
            print("[flexsim] simulatie draait", flush=True)

            t_run = time.perf_counter()
            reden = None
            while not self._stop.is_set():
                try:
                    data = self._meet(controller)
                    info = f"ok: {len(data)} van {len(ONDERDELEN)} onderdelen"
                except Exception as e:
                    data, info = {}, f"meetfout: {type(e).__name__}: {e}"
                self._set(self._maak_snapshot("running", controller.time(),
                                              time.perf_counter() - t_run, data, info))
                if self.verbose:
                    print(f"\r[flexsim] sim {controller.time():8.1f} s | {info}      ", end="", flush=True)
                if self.max_sim_time is not None and controller.time() >= self.max_sim_time:
                    reden = f"simulatietijd {self.max_sim_time:g} s bereikt"
                    break
                if self.stop_when is not None and data and self.stop_when(data):
                    reden = "stopvoorwaarde bereikt"
                    break
                self._stop.wait(self.refresh)

            controller.stop()
            try:
                data = self._meet(controller)
            except Exception:
                data = {}
            self._set(self._maak_snapshot("finished" if reden else "stopped", controller.time(),
                                          time.perf_counter() - t_run, data, reden or "gestopt"))
            print(("\n" if self.verbose else "") + f"[flexsim] {reden or 'gestopt'}", flush=True)
        except KeyboardInterrupt:
            try:
                if controller:
                    controller.stop()
            except Exception:
                pass
            self._set(self._maak_snapshot("stopped", 0.0, 0.0, {}, "gestopt met Ctrl+C"))
        except BaseException as e:
            traceback.print_exc()
            self._set(self._maak_snapshot("error", 0.0, 0.0, {}, f"{type(e).__name__}: {e}"))


if __name__ == "__main__":
    import socket
    with socket.socket() as _s:
        if _s.connect_ex(("127.0.0.1", 8000)) == 0:
            sys.exit("De API (poort 8000) draait al en heeft FlexSim al gestart. "
                     "Sluit die eerst af voordat je dit los test.")
    m = FlexSimMonitor(verbose=True, show_gui=False)
    m.run()
    print(m.snapshot()["info"])
    input("Enter om af te sluiten...")