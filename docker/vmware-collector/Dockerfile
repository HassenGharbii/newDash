FROM mcr.microsoft.com/powershell:latest

WORKDIR /opt/monitors

# VMware PowerCLI - module volumineux, image dediee pour ne pas alourdir
# les autres monitors (ping/bandwidth/switch-metrics/alertes/backup).
RUN pwsh -NoLogo -NoProfile -Command " \
    Set-PSRepository -Name PSGallery -InstallationPolicy Trusted; \
    Install-Module -Name VMware.PowerCLI -Scope AllUsers -Force -AllowClobber -ErrorAction Stop; \
    Set-PowerCLIConfiguration -InvalidCertificateAction Ignore -Confirm:\$false -Scope AllUsers | Out-Null; \
    Set-PowerCLIConfiguration -ParticipateInCeip \$false -Confirm:\$false -Scope AllUsers 2>\$null | Out-Null \
    "

# Copier les scripts du projet dans l'image
COPY ./scripts /opt/monitors

RUN chmod +x /opt/monitors/*.ps1 || true

ENTRYPOINT ["pwsh", "-NoLogo", "-NoProfile", "-File"]
