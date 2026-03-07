## Pavo gonderim notu (kisa)

Bu testlerde z-order (on/arka) acisindan en tutarli sonuc su akista goruldu:

- `communication_mode = http` (HTTP pull) veya `communication_mode = mqtt`
- Cihaza queue uzerinden gonderim:
  - HTTP pull: `EslSignValidator::queueContentForHttpDevice(...)`
  - MQTT: `MqttBrokerService::queueContentUpdate(...)`
- Kaynak olarak tek final goruntu (flatten) kullanimi

### Onemli not

Protokol tek basina kok neden degil. Ayni tasarim, farkli hazirlama adimlarinda
farkli sonuc uretebiliyor.

Pratikte iyi sonuc veren kombinasyon:

1. Tek final goruntuye yakin cikti
2. Cihazin kuyruk tabanli HTTP/MQTT akisindan yayin

Bu not sadece test ozeti icindir; kalici teknik cozum degil.
