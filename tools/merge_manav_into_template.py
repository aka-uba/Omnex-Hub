import csv
import re
import shutil
from difflib import SequenceMatcher
from pathlib import Path


TEMPLATE = Path("kutuphane/urun-listesi-son.csv")
MANAV = Path("tasarımlar/import/MANAV_URUNLERI.csv")


TR_MAP = str.maketrans(
    {
        "ı": "i",
        "İ": "i",
        "ş": "s",
        "Ş": "s",
        "ğ": "g",
        "Ğ": "g",
        "ü": "u",
        "Ü": "u",
        "ö": "o",
        "Ö": "o",
        "ç": "c",
        "Ç": "c",
    }
)


def norm(s: str) -> str:
    s = (s or "").strip().translate(TR_MAP).lower()
    s = re.sub(
        r"\b(kg|kilogram|adet|paket|demet|top|cuval|taze|lux|ekonomik|beyaz|kirmizi|siyah|yesil)\b",
        " ",
        s,
    )
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def ratio(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def main() -> int:
    if not TEMPLATE.exists():
        raise SystemExit(f"Template not found: {TEMPLATE}")
    if not MANAV.exists():
        raise SystemExit(f"ERP export not found: {MANAV}")

    backup = TEMPLATE.with_suffix(TEMPLATE.suffix + ".bak")
    shutil.copyfile(TEMPLATE, backup)

    # Read MANAV_URUNLERI.csv (comma separated)
    manav_rows = []
    # Use utf-8-sig to safely handle BOM in ERP exports (otherwise "Kod" might become "\ufeffKod")
    with MANAV.open("r", encoding="utf-8-sig", newline="") as f:
        rdr = csv.DictReader(f)
        for r in rdr:
            if not any((v or "").strip() for v in r.values()):
                continue
            name = (r.get("Adı") or "").strip()
            if not name:
                continue
            manav_rows.append({"raw": r, "name": name, "key": norm(name)})

    by_key: dict[str, list[dict]] = {}
    for mr in manav_rows:
        by_key.setdefault(mr["key"], []).append(mr)

    # Read template (semicolon separated)
    with TEMPLATE.open("r", encoding="utf-8", newline="") as f:
        rows = list(csv.reader(f, delimiter=";"))

    header = rows[0]
    idx = {h.strip(): i for i, h in enumerate(header)}

    def idx_any(*names: str):
        for n in names:
            if n in idx:
                return idx[n]
        return None

    col = {
        "Kod": idx_any("Kod"),
        "Urun": idx_any("Ürün", " Ürün "),
        "Barkod": idx_any("Barkod"),
        "Birim": idx_any("Birim", " Birim "),
        "ToptanKDV": idx_any("Toptan KDV", " Toptan KDV "),
        "PerakendeKDV": idx_any("Perakende KDV", " Perakende KDV "),
        "Fiyat": idx_any("Fiyat"),
        "FiyatTarih": idx_any("Fiyat değişiklik Tarihi"),
        "Miktar": idx_any("Eldeki Miktar"),
        "KampFiyat": idx_any("Kampanyalı Fiyat"),
        "KampTarih": idx_any("Kampanyalı Fiyat değişiklik tarihi"),
        "Iskonto": idx_any("İskonto.", "İskonto"),
        "Kunye": idx_any("KÜNYE NUMARASI"),
        "Grup": idx_any("Grup"),
        "Mensei": idx_any("Menşei", " Menşei "),
    }

    for k in ["Kod", "Urun", "Barkod", "Grup"]:
        if col[k] is None:
            raise SystemExit(f"Header mapping failed for '{k}'. Found headers: {header}")

    filled_cells = 0
    ambiguous = []
    unmatched = []

    def set_if_empty(row: list[str], col_idx: int | None, value):
        nonlocal filled_cells
        if col_idx is None:
            return
        cur = (row[col_idx] if col_idx < len(row) else "") or ""
        if str(cur).strip() != "":
            return
        if value is None:
            return
        val = str(value).strip()
        if val == "":
            return
        row[col_idx] = val
        filled_cells += 1

    for i in range(1, len(rows)):
        row = rows[i]
        if len(row) < len(header):
            row += [""] * (len(header) - len(row))

        grup = (row[col["Grup"]] or "").strip()
        if grup.lower() != "manav":
            continue

        urun_name = (row[col["Urun"]] or "").strip()
        if not urun_name:
            continue

        key = norm(urun_name)

        match = None
        candidates = by_key.get(key, [])
        if len(candidates) == 1:
            match = candidates[0]
        else:
            best = (0.0, None)
            second = 0.0
            for mr in manav_rows:
                if not mr["key"] or not key:
                    continue
                sc = ratio(key, mr["key"])
                if sc > best[0]:
                    second = best[0]
                    best = (sc, mr)
                elif sc > second:
                    second = sc
            if best[0] >= 0.92 and (best[0] - second) >= 0.03:
                match = best[1]
            elif candidates:
                ambiguous.append((i + 1, urun_name, [c["name"] for c in candidates][:5]))
                continue
            else:
                unmatched.append((i + 1, urun_name))
                continue

        src = match["raw"]

        # IMPORTANT: only fill empty cells; do NOT touch product name / categories / group.
        set_if_empty(row, col["Kod"], src.get("Kod"))
        set_if_empty(row, col["Barkod"], src.get("Barkod"))
        set_if_empty(row, col["Birim"], src.get("Birim"))
        set_if_empty(row, col["ToptanKDV"], src.get("Toptan KDV"))
        set_if_empty(row, col["PerakendeKDV"], src.get("Perakende KDV"))
        set_if_empty(row, col["Fiyat"], src.get("Fiyat"))
        set_if_empty(row, col["FiyatTarih"], src.get("Fiyat değişiklik Tarihi"))
        set_if_empty(row, col["Miktar"], src.get("Eldeki Miktar"))
        set_if_empty(row, col["KampFiyat"], src.get("Kampanyalı Fiyat"))
        set_if_empty(row, col["KampTarih"], src.get("Kampanyalı Fiyat değişiklik tarihi"))
        set_if_empty(row, col["Iskonto"], src.get("İskonto."))
        set_if_empty(row, col["Kunye"], src.get("KÜNYE NUMARASI"))
        set_if_empty(row, col["Mensei"], src.get("Menşei"))

        rows[i] = row

    with TEMPLATE.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, delimiter=";", lineterminator="\n")
        w.writerows(rows)

    print(f"Backup created: {backup}")
    print(f"Filled cells: {filled_cells}")
    print(f"Ambiguous rows: {len(ambiguous)}")
    print(f"Unmatched rows: {len(unmatched)}")
    if ambiguous[:10]:
        print("Ambiguous examples:")
        for ln, name, cands in ambiguous[:10]:
            print(f" - line {ln}: {name} -> {cands}")
    if unmatched[:20]:
        print("Unmatched examples:")
        for ln, name in unmatched[:20]:
            print(f" - line {ln}: {name}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())


