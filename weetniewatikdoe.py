import os
import sys
scriptPath = os.path.dirname(os.path.realpath(__file__))
pDir = scriptPath + "\\..\\..\\..\\program\\";
program = r"C:\Program Files\Autodesk\FlexSim 2027\program"
omni = r"C:\Program Files\Autodesk\FlexSim 2027\modules\Omniverse"
flexsimpy = r"C:\Program Files\Autodesk\FlexSim 2027\modules\FlexSimPy-main\out\Rel_3_10"

for p in (program, omni, flexsimpy):
    os.add_dll_directory(p)

os.environ["PATH"] = program + os.pathsep + omni + os.pathsep + os.environ["PATH"]
sys.path.insert(0, flexsimpy)

import FlexSimPy

print("Python:", sys.version)
print("FlexSimPy:", FlexSimPy.__file__)
controller = FlexSimPy.launch(evaluationLicense=True, showGUI=False, programDir=pDir)
controller.open(scriptPath + "\\future factory.fsx");4
controller.open(scriptPath + "\\TestSendReceive.fsm");
controller.reset();
controller.run(10);