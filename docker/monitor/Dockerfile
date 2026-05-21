FROM mcr.microsoft.com/powershell:latest

WORKDIR /opt/monitors

# Copier les scripts du projet dans l'image
COPY ./scripts /opt/monitors

# Rendre les scripts executables si possible
RUN chmod +x /opt/monitors/*.ps1 || true

# Par défaut, demarrer pwsh en mode fichier (le 'command' compose fournira le script)
ENTRYPOINT ["pwsh", "-NoLogo", "-NoProfile", "-File"]
