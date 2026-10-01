"""
Resolve (nested) Git conflict markers in a FlexSim .fsx file.

For every conflict block it keeps the INCOMING side (the branch you merged in,
e.g. "rolf"), stripping any leftover markers inside it. It also lists which
FlexSim nodes were in conflict, so you can check that none of them is real
model logic (the "flh" save-history node is always safe).

Usage:
    python fix_conflicts.py "future factory.fsx"

A backup is written next to the file as <name>.fsx.bak before changing it.
"""
import re
import shutil
import sys

START, MID, END = "<<<<<<<", "=======", ">>>>>>>"


def resolve(lines, conflicts):
    out, i = [], 0
    while i < len(lines):
        line = lines[i]
        if not line.startswith(START):
            if line.startswith((MID, END)):
                i += 1  # stray leftover marker: drop it
                continue
            out.append(line)
            i += 1
            continue

        # Outermost conflict block: split into ours / theirs at depth 1
        depth, section = 1, "ours"
        ours, theirs = [], []
        i += 1
        while i < len(lines) and depth > 0:
            l = lines[i]
            if l.startswith(START):
                depth += 1
                (ours if section == "ours" else theirs).append(l)
            elif l.startswith(MID) and depth == 1:
                section = "theirs"
            elif l.startswith(END):
                depth -= 1
                if depth > 0:
                    (ours if section == "ours" else theirs).append(l)
            else:
                (ours if section == "ours" else theirs).append(l)
            i += 1

        names = set()
        for l in ours + theirs:
            names.update(re.findall(r"<name>([^<]*)</name>", l))
        conflicts.append(sorted(names) or ["(no node names found)"])

        out.extend(resolve(theirs, conflicts))  # strip nested markers too
    return out


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    path = sys.argv[1]
    with open(path, encoding="utf-8", newline="") as f:
        lines = f.read().splitlines(keepends=True)

    conflicts = []
    fixed = resolve(lines, conflicts)

    if not conflicts:
        print("No conflict markers found. Nothing changed.")
        return

    shutil.copyfile(path, path + ".bak")
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.writelines(fixed)

    print(f"Resolved {len(conflicts)} conflict block(s), kept the incoming side:")
    for n, names in enumerate(conflicts, 1):
        print(f"  {n}. nodes: {', '.join(names)}")
    print(f"Backup saved as {path}.bak")
    print("Now open the model in FlexSim to check it loads, then:")
    print(f'  git add "{path}"  &&  git commit')


if __name__ == "__main__":
    main()
