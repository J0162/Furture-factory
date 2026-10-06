import os
import sys
 
if sys.platform != "win32":
    sys.exit("FlexSim only runs on Windows - run this on a Windows PC/VM.")
if sys.version_info[:2] != (3, 10):
    sys.exit(f"FlexSimPy Rel_3_10 needs Python 3.10, you are on {sys.version.split()[0]}")
 
scriptPath = os.path.dirname(os.path.realpath(__file__))
base      = r"C:\Program Files\Autodesk\FlexSim 2027"
program   = os.path.join(base, "program")
omni      = os.path.join(base, "modules", "Omniverse")
flexsimpy = os.path.join(base, "modules", "FlexSimPy-main", "out", "Rel_3_10")
 
for p in (program, omni, flexsimpy):
    if not os.path.isdir(p):
        sys.exit(f"Folder not found: {p}")
    os.add_dll_directory(p)
 
os.environ["PATH"] = program + os.pathsep + omni + os.pathsep + os.environ["PATH"]
sys.path.insert(0, flexsimpy)
 
import FlexSimPy
 
model = os.path.join(scriptPath, "future factory.fsx")
if not os.path.isfile(model):
    sys.exit(f"Model not found: {model}")
 
controller = FlexSimPy.launch(evaluationLicense=True, showGUI=True, programDir=program)
controller.open(model)
controller.reset()
controller.run(1000000)