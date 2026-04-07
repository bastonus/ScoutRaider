"""
Build script — Cross-platform PyInstaller build for Scout Design Suite.
Usage: python build.py
"""
import os
import sys
import platform
import subprocess

def main():
    print("=" * 60)
    print("  Scout Design Suite — Build Script")
    print("=" * 60)

    # Detect OS
    os_name = platform.system()
    print(f"\n🖥️  Plateforme détectée : {os_name} ({platform.machine()})")

    # Check PyInstaller
    try:
        import PyInstaller
        print(f"✅ PyInstaller {PyInstaller.__version__} trouvé")
    except ImportError:
        print("❌ PyInstaller n'est pas installé.")
        print("   Installez-le avec : pip install pyinstaller")
        sys.exit(1)

    # Validate spec file exists
    script_dir = os.path.dirname(os.path.abspath(__file__))
    spec_file = os.path.join(script_dir, "ScoutCarnet.spec")
    
    if not os.path.exists(spec_file):
        print(f"❌ Fichier spec introuvable : {spec_file}")
        sys.exit(1)

    print(f"📦 Fichier spec : {spec_file}")
    print(f"\n🚀 Lancement du build PyInstaller...\n")

    # Run PyInstaller
    cmd = [sys.executable, "-m", "PyInstaller", spec_file, "--noconfirm"]
    
    result = subprocess.run(cmd, cwd=script_dir)

    if result.returncode != 0:
        print("\n❌ Le build a échoué. Vérifiez les erreurs ci-dessus.")
        sys.exit(1)

    # Post-build info
    dist_dir = os.path.join(script_dir, "dist", "ScoutCarnet")
    print("\n" + "=" * 60)
    print("  ✅ BUILD TERMINÉ AVEC SUCCÈS")
    print("=" * 60)
    print(f"\n📂 Dossier de sortie : {dist_dir}")

    if os_name == "Windows":
        exe_path = os.path.join(dist_dir, "ScoutCarnet.exe")
        print(f"🎯 Exécutable : {exe_path}")
        print("\n💡 Pour créer un installeur Windows :")
        print("   - Utilisez Inno Setup (https://jrsoftware.org/isinfo.php)")
        print("   - Ou distribuez le dossier dist/ScoutCarnet/ en archive ZIP")
    elif os_name == "Darwin":
        app_path = os.path.join(dist_dir, "ScoutCarnet")
        print(f"🎯 Application : {app_path}")
        print("\n💡 Pour créer un .dmg macOS :")
        print("   pip install dmgbuild")
        print("   dmgbuild -s dmg_settings.py 'Scout Design Suite' ScoutDesignSuite.dmg")
    elif os_name == "Linux":
        bin_path = os.path.join(dist_dir, "ScoutCarnet")
        print(f"🎯 Binaire : {bin_path}")
        print("\n💡 Pour créer un AppImage Linux :")
        print("   - Utilisez appimagetool (https://appimage.github.io/)")
        print("   - Ou distribuez le dossier dist/ScoutCarnet/ en archive .tar.gz")

    print(f"\n⚠️  N'oubliez pas de tester l'application packagée avant de distribuer !")


if __name__ == "__main__":
    main()
