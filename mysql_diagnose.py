"""Run on the Windows laptop:  python mysql_diagnose.py
Times every step of connecting to MySQL so we can see what is slow."""
import time, socket, sys

HOST, PORT, USER, PW, DB = "127.0.0.1", 3306, "root", "welkom", "Packages"

def t(label, fn):
    start = time.perf_counter()
    try:
        r = fn()
        print(f"{label:<45} {time.perf_counter()-start:7.3f} s")
        return r
    except Exception as e:
        print(f"{label:<45} {time.perf_counter()-start:7.3f} s  FOUT: {type(e).__name__}: {e}")

print("Python", sys.version.split()[0])
t("socket.getfqdn() (DNS van deze pc)", socket.getfqdn)
t("TCP verbinding naar 127.0.0.1:3306", lambda: socket.create_connection((HOST, PORT), 5).close())

mc = t("import mysql.connector", lambda: __import__("mysql.connector").connector)
if not mc: sys.exit()
print("mysql-connector-python versie:", mc.__version__)
try:
    import _mysql_connector; print("C-extensie: aanwezig")
except ImportError:
    print("C-extensie: NIET aanwezig (alleen pure Python)")

for pure in (False, True):
    for nossl in (False, True):
        for i in range(2):
            c = t(f"connect pure={pure} ssl_disabled={nossl} #{i+1}",
                  lambda: mc.connect(host=HOST, port=PORT, user=USER, password=PW, database=DB,
                                     use_pure=pure, ssl_disabled=nossl, connection_timeout=15))
            if c: c.close()

c = mc.connect(host=HOST, port=PORT, user=USER, password=PW, database=DB)
cur = c.cursor()
def q(sql):
    cur.execute(sql); return cur.fetchall()
print()
for sql in ["SELECT VERSION()",
            "SHOW VARIABLES LIKE 'skip_name_resolve'",
            "SHOW VARIABLES LIKE 'max_connections'",
            "SHOW STATUS LIKE 'Threads_connected'",
            "SHOW STATUS LIKE 'Aborted_connects'",
            "SELECT COUNT(*) FROM weights",
            "SELECT COUNT(*) FROM Warehouse"]:
    r = t(sql, lambda: q(sql)); print("   ->", r)
r = t("SELECT * FROM weights (alles ophalen)", lambda: q("SELECT * FROM weights"))
r = t("SHOW PROCESSLIST", lambda: q("SHOW FULL PROCESSLIST"))
if r:
    slapend = [x for x in r if x[4] == "Sleep"]
    print(f"   -> {len(r)} verbindingen open, waarvan {len(slapend)} 'Sleep' (blijven hangen)")
c.close()
