@echo off
REM ============================================================
REM  ReliableAI — Genera los base64 para los GitHub Secrets
REM  Ejecutar desde la carpeta donde estan los archivos .p12 .mobileprovision .p8
REM ============================================================

echo.
echo === IOS_DISTRIBUTION_CERT_BASE64 ===
certutil -encodehex -f distribution.p12 tmp_cert.b64 0x40000001 > nul
type tmp_cert.b64
del tmp_cert.b64

echo.
echo === IOS_PROVISIONING_PROFILE_BASE64 ===
certutil -encodehex -f ReliableAI.mobileprovision tmp_prov.b64 0x40000001 > nul
type tmp_prov.b64
del tmp_prov.b64

echo.
echo === ASC_PRIVATE_KEY_BASE64 ===
REM Cambia AuthKey_XXXXXX.p8 por el nombre real del archivo
for %%f in (AuthKey_*.p8) do (
  certutil -encodehex -f "%%f" tmp_key.b64 0x40000001 > nul
  type tmp_key.b64
  del tmp_key.b64
)

echo.
echo ============================================================
echo Copia cada bloque como valor del Secret correspondiente
echo en: https://github.com/juanjomir-debug/jj-multi-llm-research/settings/secrets/actions
echo ============================================================
pause
