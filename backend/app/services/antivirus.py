# app/services/antivirus.py
import time
from pathlib import Path

def scan_file(path: Path) -> bool:
    # псевдо-сканирование
    time.sleep(0.5)
    # можно добавить простую проверку по расширению/размеру
    return True
