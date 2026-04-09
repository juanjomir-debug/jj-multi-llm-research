import sys, os
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
import paramiko

BASE = r'C:\Users\juanj\OneDrive\Desktop\Prueba claude\multi-llm'
REMOTE = '/var/www/reliableai'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('187.124.184.177', username='root', password='Z4.HCJf8D&A1lU,V', timeout=15)
sftp = client.open_sftp()

def run(cmd, timeout=30):
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    return out, err

def upload(local_rel, remote_rel=None):
    lpath = os.path.join(BASE, local_rel)
    rpath = REMOTE + '/' + (remote_rel or local_rel).replace('\\', '/')
    # Ensure remote dir exists
    rdir = rpath.rsplit('/', 1)[0]
    run(f'mkdir -p {rdir}')
    sftp.put(lpath, rpath)
    print(f'  uploaded: {local_rel}')

files = [
    'server.js',
    'db.js',
    'admin-middleware.js',
    'admin-routes.js',
    'public/index.html',
    'public/admin.html',
    'public/landing.html',
    'prompts/amplitude.json',
    'prompts/model_strengths.json',
]

print('Uploading files...')
for f in files:
    try:
        upload(f)
    except Exception as e:
        print(f'  SKIP {f}: {e}')

# Upload prompts dir fully
prompts_dir = os.path.join(BASE, 'prompts')
for fname in os.listdir(prompts_dir):
    lpath = os.path.join(prompts_dir, fname)
    if os.path.isfile(lpath):
        rpath = f'{REMOTE}/prompts/{fname}'
        try:
            sftp.put(lpath, rpath)
            print(f'  uploaded: prompts/{fname}')
        except Exception as e:
            print(f'  SKIP prompts/{fname}: {e}')

# Update VPS .env — only SMTP block (don't overwrite API keys)
print('\nUpdating SMTP config in VPS .env...')
out, _ = run(f'cat {REMOTE}/.env')
if 'SMTP_HOST' in out:
    # Update existing SMTP lines
    run(f"sed -i 's|^SMTP_HOST=.*|SMTP_HOST=mail.hostalia.com|' {REMOTE}/.env")
    run(f"sed -i 's|^SMTP_PORT=.*|SMTP_PORT=587|' {REMOTE}/.env")
    run(f"sed -i 's|^SMTP_SECURE=.*|SMTP_SECURE=false|' {REMOTE}/.env")
    run(f"sed -i 's|^SMTP_USER=.*|SMTP_USER=info@reliableai.net|' {REMOTE}/.env")
    run(f"sed -i 's|^SMTP_PASS=.*|SMTP_PASS=Callemurillo22|' {REMOTE}/.env")
    # Add SMTP_CIPHERS if not present
    out2, _ = run(f'grep -c SMTP_CIPHERS {REMOTE}/.env')
    if out2.strip() == '0':
        run(f"echo 'SMTP_CIPHERS=DEFAULT@SECLEVEL=0' >> {REMOTE}/.env")
    run(f"sed -i 's|^SMTP_FROM=.*|SMTP_FROM=\"ReliableAI\" <info@reliableai.net>|' {REMOTE}/.env")
    print('  SMTP config updated')
else:
    # Append SMTP block
    smtp_block = """
# SMTP — Email verification
SMTP_HOST=mail.hostalia.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_CIPHERS=DEFAULT@SECLEVEL=0
SMTP_USER=info@reliableai.net
SMTP_PASS=Callemurillo22
SMTP_FROM="ReliableAI" <info@reliableai.net>
"""
    run(f"echo '{smtp_block}' >> {REMOTE}/.env")
    print('  SMTP block appended')

# Set ADMIN_EMAIL if not set
out, _ = run(f'grep ADMIN_EMAIL {REMOTE}/.env')
if not out.strip():
    run(f"echo 'ADMIN_EMAIL=info@reliableai.net' >> {REMOTE}/.env")
    print('  ADMIN_EMAIL set')

# Restart PM2
print('\nRestarting PM2...')
out, err = run('pm2 restart reliableai --update-env 2>&1 || pm2 restart all --update-env 2>&1', timeout=30)
print(out or err)

# Check status
out, _ = run('pm2 list 2>&1 | head -20')
print('\nPM2 status:')
print(out)

sftp.close()
client.close()
print('\nDeploy complete.')
