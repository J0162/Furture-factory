import os
import sys
scriptPath = os.path.dirname(os.path.realpath(__file__))
pDir = scriptPath + "\\..\\..\\..\\program\\";
program = r"C:\Program Files\Autodesk\FlexSim 2027\program"
flexsimpy = r"C:\Program Files\Autodesk\FlexSim 2027\modules\FlexSimPy-main\out\Rel_3_10"

for p in (program, flexsimpy):
    os.add_dll_directory(p)

os.environ["PATH"] = program + os.pathsep + os.pathsep + os.environ["PATH"]
sys.path.insert(0, flexsimpy)

import FlexSimPy

print("Python:", sys.version)
print("FlexSimPy:", FlexSimPy.__file__)

print("Launching...", flush=True)
controller = FlexSimPy.launch(evaluationLicense=False, showGUI=True, programDir=program + "\\")

print("Launched, opening model...", flush=True)

controller.open(os.path.join(scriptPath, "future factory.fsx"))
print("Model opened, resetting...", flush=True)
controller.reset()
print("Running...", flush=True)
controller.run(1000)

input("Done - FlexSim stays open until you press Enter here...")