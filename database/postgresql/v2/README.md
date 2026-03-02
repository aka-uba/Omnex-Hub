# PostgreSQL V2 Moduler Sema

- Kaynak: `database/omnex.db` canli semasi
- Uretim scripti: `tools/postgresql/generate_modular_schema.php`
- Uretim tarihi: 2026-02-26 12:38:47

## Uygulama Sirasi
1. `00_extensions.sql`
2. `01_schemas.sql`
3. `10_core.sql`
4. `11_license.sql`
5. `12_catalog.sql`
6. `13_branch.sql`
7. `14_labels.sql`
8. `15_media.sql`
9. `16_devices.sql`
10. `17_signage.sql`
11. `18_integration.sql`
12. `19_audit.sql`
13. `20_legacy.sql`
14. `30_constraints.sql`
15. `40_indexes.sql`
16. `70_rls.sql`

## Notlar
- Bu cikti baseline uretimdir; kritik tablolar icin manuel constraint/type review gerekir.
- `products.id` icinde UUID disi kayit oldugu icin cutover oncesi normalize edilmelidir.
- `hanshow_esls.has_led/has_magnet` alanlarindaki bos string degerler boolean migrate oncesi temizlenmelidir.

