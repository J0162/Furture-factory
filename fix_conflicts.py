"""
Safely resolve Git conflicts in a FlexSim .fsx file.

- Conflict blocks that only touch "noise" nodes (like flh, FlexSim's save
  history) are resolved automatically.
- EVERY OTHER conflict block is left untouched, markers and all, and listed
  in a report so you can decide what to keep.

Usage:
    python fix_conflicts.py "future factory.fsx"

A backup is written as <name>.fsx.bak before anything is changed.
"""
import re
import shutil
import sys

START, MID, END = "<<<<<<<", "=======", ">>>>>>>"

# Nodes that change on every save and are safe to take from either side.
SAFE_NODES = {"flh"}

NAME_RE = re.compile(r"<name>([^<]*)</name>")


def names_in(lines):
    found = []
    for l in lines:
        for n in NAME_RE.findall(l):
            if n and n not in found:
                found.append(n)
    return found


def strip_markers(lines):
    """Keep the last side of any (nested) conflict, dropping all markers."""
    out, i = [], 0
    while i < len(lines):
        if lines[i].startswith(START):
            depth, theirs, in_theirs = 1, [], False
            i += 1
            while i < len(lines) and depth:
                l = lines[i]
                if l.startswith(START):
                    depth += 1
                elif l.startswith(MID) and depth == 1:
                    in_theirs, theirs = True, []
                elif l.startswith(END):
                    depth -= 1
                elif in_theirs:
                    theirs.append(l)
                elif depth > 1:
                    pass
                i += 1
            out.extend(strip_markers(theirs))
        elif lines[i].startswith((MID, END)):
            i += 1
        else:
            out.append(lines[i])
            i += 1
    return out


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    path = sys.argv[1]
    with open(path, encoding="utf-8", newline="") as f:
        lines = f.read().splitlines(keepends=True)

    out, report, i = [], [], 0
    while i < len(lines):
        if not lines[i].startswith(START):
            out.append(lines[i])
            i += 1
            continue

        start_line = i + 1
        block, depth = [lines[i]], 1
        ours, theirs, section = [], [], "ours"
        i += 1
        while i < len(lines) and depth:
            l = lines[i]
            block.append(l)
            if l.startswith(START):
                depth += 1
            elif l.startswith(MID) and depth == 1:
                section = "theirs"
                i += 1
                continue
            elif l.startswith(END):
                depth -= 1
                if depth == 0:
                    i += 1
                    break
            (ours if section == "ours" else theirs).append(l)
            i += 1

        ours_names, theirs_names = names_in(ours), names_in(theirs)
        all_names = set(ours_names) | set(theirs_names)

        if all_names and all_names <= SAFE_NODES:
            out.extend(strip_markers(theirs))
            report.append(("AUTO", start_line, ours_names, theirs_names,
                           len(ours), len(theirs)))
        else:
            out_line = len(out) + 1
            out.extend(block)
            report.append(("MANUAL", out_line, ours_names, theirs_names,
                           len(ours), len(theirs)))

    if not report:
        print("No conflict markers found. Nothing changed.")
        return

    auto = [r for r in report if r[0] == "AUTO"]
    manual = [r for r in report if r[0] == "MANUAL"]

    if auto:
        shutil.copyfile(path, path + ".bak")
        with open(path, "w", encoding="utf-8", newline="") as f:
            f.writelines(out)

    print(f"Found {len(report)} conflict block(s).")
    print(f"  Auto-resolved (noise only): {len(auto)}")
    print(f"  Left for you to decide:     {len(manual)}\n")

    for kind, line, on, tn, ol, tl in manual:
        print(f"- Conflict at line {line} (in the file as it is now)")
        print(f"    Your side  (HEAD):     {ol} lines, nodes: {', '.join(on) or '-'}")
        print(f"    Incoming side:         {tl} lines, nodes: {', '.join(tn) or '-'}")

    if auto:
        print(f"\nBackup of the original saved as {path}.bak")
    if manual:
        print("\nThe blocks listed above still have their markers. "
              "Search for <<<<<<< in VS Code to find them.")
    else:
        print("\nAll done. Open the model in FlexSim to check it, then:")
        print(f'  git add "{path}"  &&  git commit')


if __name__ == "__main__":
    main()