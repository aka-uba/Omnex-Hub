# Pavo BLE Factory Reset Runbook (2026-03-12)

Bu dokuman, `@B` cihazlari gun icinde tekrar test etmek icin hazirlandi.
Tokenlar dokumana acik metin olarak yazilmaz; komutlar mevcut veritabanindaki kayitlardan anlik uretilir.

## Hedef Cihazlar

- `@B2A301AB37` - IP: `192.168.1.160` - Device ID: `20:51:F5:4F:50:59`
- `@B2A401A959` - IP: `192.168.1.161` - Device ID: `20:51:F5:4F:50:0A`
- `@B2A401A977` - IP: `192.168.1.172` - Device ID: `20:51:F5:4F:50:7F`

## Reset Komut Formati

```text
+SET-DEVICE:{"Restore":0, "Token":"<BT_TOKEN>"}\r\n
```

## Tokenlari DB'den Cekip Reset Komutlarini Uretme

Asagidaki komut, mevcut DB kaydindaki `bt_password_encrypted` alanini decrypt ederek her hedef cihaz icin reset komutu uretir:

```powershell
@'
<?php
require __DIR__ . '/../config.php';
$db = Database::getInstance();
$targets = ['@B2A301AB37', '@B2A401A959', '@B2A401A977'];

foreach ($targets as $name) {
    $row = $db->fetch(
        "SELECT name, bt_password_encrypted FROM devices WHERE name = ? LIMIT 1",
        [$name]
    );
    if (!$row || empty($row['bt_password_encrypted'])) {
        echo $name . " | TOKEN_YOK" . PHP_EOL;
        continue;
    }

    $token = Security::decrypt((string)$row['bt_password_encrypted']);
    if (!is_string($token) || $token === '') {
        echo $name . " | TOKEN_DECRYPT_HATA" . PHP_EOL;
        continue;
    }

    $cmd = '+SET-DEVICE:{"Restore":0, "Token":"' . $token . '"}' . "\r\n";
    echo $name . " | " . $cmd . PHP_EOL;
}
'@ | php
```

## BLE Uzerinden Canli Gonderim (Python/bleak)

Bu akista tokenlar DB'den alinir, BLE scan sonrasi eslesen cihaza reset komutu gonderilir.

```powershell
@'
import asyncio
import json
import subprocess
from bleak import BleakScanner, BleakClient

WRITE_UUID = '0000fff2-0000-1000-8000-00805f9b34fb'
NOTIFY_UUID = '0000fff1-0000-1000-8000-00805f9b34fb'
TARGETS = ['@B2A301AB37', '@B2A401A959', '@B2A401A977']

PHP_SNIPPET = r'''
<?php
require __DIR__ . '/../config.php';
$db = Database::getInstance();
$targets = ['@B2A301AB37', '@B2A401A959', '@B2A401A977'];
$out = [];
foreach ($targets as $name) {
  $row = $db->fetch("SELECT name, bt_password_encrypted FROM devices WHERE name = ? LIMIT 1", [$name]);
  if (!$row || empty($row['bt_password_encrypted'])) continue;
  $token = Security::decrypt((string)$row['bt_password_encrypted']);
  if (!is_string($token) || $token === '') continue;
  $out[] = ['name' => $name, 'token' => $token];
}
echo json_encode($out);
'''

async def run():
    proc = subprocess.run(['php', '-r', PHP_SNIPPET], capture_output=True, text=True, check=True)
    rows = json.loads(proc.stdout or '[]')
    token_map = {x['name']: x['token'] for x in rows}

    devs = await BleakScanner.discover(timeout=10.0)
    seen = {(d.name or '').strip(): d.address for d in devs if d.name}

    for name in TARGETS:
        token = token_map.get(name)
        addr = seen.get(name)
        if not token:
            print(name, 'TOKEN_YOK')
            continue
        if not addr:
            print(name, 'SCANDE_YOK')
            continue

        cmd = f'+SET-DEVICE:{{"Restore":0, "Token":"{token}"}}\\r\\n'
        chunks = []
        done = asyncio.Event()

        def cb(_, data):
            txt = bytes(data).decode('utf-8', errors='ignore').strip()
            chunks.append(txt)
            if '+DONE' in txt or '+ERROR' in txt or 'Token error' in txt:
                done.set()

        try:
            async with BleakClient(addr, timeout=12.0) as c:
                await c.start_notify(NOTIFY_UUID, cb)
                await c.write_gatt_char(WRITE_UUID, cmd.encode('utf-8'), response=True)
                try:
                    await asyncio.wait_for(done.wait(), timeout=10.0)
                except asyncio.TimeoutError:
                    pass
                await c.stop_notify(NOTIFY_UUID)
            print(name, 'RESP', ' | '.join(chunks) if chunks else '(no notify)')
        except Exception as e:
            print(name, 'ERR', str(e))

asyncio.run(run())
'@ | python -
```

## 2026-03-12 Canli Durum Notu

- `@B2A401A959`: reset komutuna `+DONE` dondu.
- `@B2A301AB37`: test aninda BLE scan'de gorulmedi.
- `@B2A401A977`: tokenli komutlarin bir kismini kabul ediyor; `Restore` komutunda `AT+ECHO=0` cevabi goruldu.

## Kisa Operasyon Kontrol Listesi

1. Cihaz reklam (advertise) acik mi (`@B...` adiyla gorunuyor mu)?
2. BLE baglantisi kurulduktan sonra tek komut dene: `Query-cycle`.
3. Sonra `Restore` komutunu token ile gonder.
4. Yanitlari kaydet: `+DONE`, `Token error`, `+ERROR`, `AT+ECHO=0`.
