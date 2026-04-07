"""
ScoutRaider Suite — Script d'installation des dépendances.
À lancer UNE SEULE FOIS lors de la première installation depuis les sources.
Les releases compilées (exe/zip) n'ont pas besoin de ce script.

Utilisation :
    python install.py
"""
import os
import sys
import subprocess


def install():
    req_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "requirements.txt")
    if not os.path.exists(req_file):
        print("Fichier requirements.txt introuvable.")
        sys.exit(1)

    print("Installation des dépendances ScoutRaider Suite...\n")

    packages = []
    with open(req_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            # Évaluer les marqueurs de plateforme : ex. "winsdk; sys_platform == 'win32'"
            if ";" in line:
                pkg, condition = line.split(";", 1)
                condition = condition.strip()
                try:
                    if not eval(condition, {"sys_platform": sys.platform}):
                        continue
                except Exception:
                    pass
                line = pkg.strip()
            packages.append(line)

    errors = []
    for pkg in packages:
        print(f"  Installation de {pkg}...", end=" ", flush=True)
        try:
            result = subprocess.call(
                [sys.executable, "-m", "pip", "install", pkg],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            if result == 0:
                print("✓")
            else:
                errors.append(pkg)
                print("✗ (ignoré)")
        except Exception as e:
            errors.append(pkg)
            print(f"✗ ({e})")

    print()
    if errors:
        print(f"Avertissement : ces dépendances n'ont pas pu être installées : {', '.join(errors)}")
        print("(Souvent dû à des dépendances optionnelles nécessitant un compilateur C++)\n")

    print("Installation terminée ! Lancez l'application avec :")
    print(f"  python main.py\n")


if __name__ == "__main__":
    install()
