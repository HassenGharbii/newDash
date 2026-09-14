FROM mcr.microsoft.com/powershell:latest

WORKDIR /opt/monitors

# net-snmp (snmpget/snmpwalk) - alternative multiplateforme a SnmpWalk.exe (binaire Windows
# qui ne peut pas s'executer ici) utilisee par CollectSwitchBandwidth.ps1/CollectSwitchMetrics.ps1
# openssh-client + sshpass - CollectStorageInfo.ps1 utilise SSH/CLI vers les baies Seagate
# (l'API REST de ces baies peut refuser des comptes valides cote GUI selon le firmware -
# le CLI via SSH s'est avere plus fiable)
RUN apt-get update \
    && apt-get install -y --no-install-recommends snmp openssh-client sshpass \
    && rm -rf /var/lib/apt/lists/*

# Copier les scripts du projet dans l'image
COPY ./scripts /opt/monitors

# Rendre les scripts executables si possible
RUN chmod +x /opt/monitors/*.ps1 || true

# Par défaut, demarrer pwsh en mode fichier (le 'command' compose fournira le script)
ENTRYPOINT ["pwsh", "-NoLogo", "-NoProfile", "-File"]
