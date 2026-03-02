import json
import os
import re
import sys
import time
from dataclasses import dataclass
from typing import Any, List, Tuple, Optional, Dict

from deep_translator import GoogleTranslator


# JSON object represented as list of (key, value) pairs.
# This preserves key order AND duplicate keys (important: `common.json` contains duplicates).
PairObject = List[Tuple[str, Any]]

ARABIC_CHARS_RE = re.compile(r"[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]")


def is_pair_object(v: Any) -> bool:
    return isinstance(v, list) and (
        len(v) == 0 or all(isinstance(x, tuple) and len(x) == 2 and isinstance(x[0], str) for x in v)
    )


def load_json_pairs(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    return json.loads(text, object_pairs_hook=list)


def _json_dumps_str(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


def dump_json_pairs(value: Any, indent: int = 4) -> str:
    def _dump(v: Any, level: int) -> str:
        pad = " " * (indent * level)
        pad_in = " " * (indent * (level + 1))

        if is_pair_object(v):
            if not v:
                return "{}"
            parts: List[str] = ["{"]
            for i, (k, vv) in enumerate(v):
                comma = "," if i < len(v) - 1 else ""
                parts.append(f'{pad_in}{_json_dumps_str(k)}: {_dump(vv, level + 1)}{comma}')
            parts.append(f"{pad}}}")
            return "\n".join(parts)

        if isinstance(v, list):
            if not v:
                return "[]"
            parts = ["["]
            for i, item in enumerate(v):
                comma = "," if i < len(v) - 1 else ""
                parts.append(f"{pad_in}{_dump(item, level + 1)}{comma}")
            parts.append(f"{pad}]")
            return "\n".join(parts)

        if isinstance(v, str):
            return _json_dumps_str(v)

        return json.dumps(v, ensure_ascii=False)

    return _dump(value, 0) + "\n"


PH_RE = re.compile(r"\{[^{}]+\}")


def protect_placeholders(s: str) -> Tuple[str, List[str]]:
    placeholders: List[str] = []

    def _repl(m: re.Match) -> str:
        placeholders.append(m.group(0))
        return f"__PH_{len(placeholders)-1}__"

    protected = PH_RE.sub(_repl, s)
    return protected, placeholders


def restore_placeholders(s: str, placeholders: List[str]) -> str:
    out = s
    for i, ph in enumerate(placeholders):
        out = out.replace(f"__PH_{i}__", ph)
    return out


@dataclass
class ExcludeRules:
    # Exclude translating anything under a key named "languages"
    exclude_languages_subtree: bool = True
    # Exclude header language label (language selector label)
    exclude_header_language_label: bool = True


def should_exclude_translation(path_keys: List[str], current_key: Optional[str], rules: ExcludeRules) -> bool:
    # If we're inside any "languages" object subtree, exclude.
    if rules.exclude_languages_subtree and ("languages" in path_keys):
        return True

    if rules.exclude_header_language_label and current_key == "language":
        # Exclude header.language and layout.header.language labels specifically.
        # Path examples:
        #   ["header"] + current_key="language"
        #   ["layout","header"] + current_key="language"
        if len(path_keys) >= 1 and path_keys[-1] == "header":
            return True
        if len(path_keys) >= 2 and path_keys[-2:] == ["layout", "header"]:
            return True

    return False


class Translator:
    def __init__(self, sleep_sec: float = 0.03):
        self.t = GoogleTranslator(source="en", target="ar")
        self.cache: Dict[str, str] = {}
        self.sleep_sec = sleep_sec

    def translate(self, text: str) -> str:
        text = text.strip("\ufeff")
        if text == "":
            return text
        if text in self.cache:
            return self.cache[text]

        protected, placeholders = protect_placeholders(text)
        translated = None
        for attempt in range(3):
            try:
                translated = self.t.translate(protected)
                break
            except Exception:
                # Backoff for transient failures (rate limiting / network hiccups)
                time.sleep(1.2 * (attempt + 1))
        if translated is None:
            # If translation fails, fall back to original text.
            translated = protected
        translated = restore_placeholders(translated, placeholders)
        self.cache[text] = translated

        if self.sleep_sec:
            time.sleep(self.sleep_sec)
        return translated


def translate_pairs_in_parallel(
    ar_val: Any,
    en_val: Any,
    translator: Translator,
    rules: ExcludeRules,
    path_keys: Optional[List[str]] = None,
) -> Any:
    if path_keys is None:
        path_keys = []

    # Objects (pair-list)
    if is_pair_object(ar_val) and is_pair_object(en_val):
        out: PairObject = []
        en_pairs: PairObject = en_val
        ar_pairs: PairObject = ar_val

        def en_lookup_first(key: str) -> Optional[Any]:
            for k, v in en_pairs:
                if k == key:
                    return v
            return None

        for idx, (ar_k, ar_v) in enumerate(ar_pairs):
            en_k = en_pairs[idx][0] if idx < len(en_pairs) else None
            en_v = en_pairs[idx][1] if idx < len(en_pairs) else en_lookup_first(ar_k)
            if en_k is not None and en_k != ar_k:
                en_v = en_lookup_first(ar_k)
            out_v = translate_pairs_in_parallel(
                ar_v,
                en_v,
                translator,
                rules,
                path_keys=path_keys + [ar_k],
            )
            out.append((ar_k, out_v))
        return out

    # Arrays
    if isinstance(ar_val, list) and not is_pair_object(ar_val) and isinstance(en_val, list) and not is_pair_object(en_val):
        out_list: List[Any] = []
        for i, item in enumerate(ar_val):
            en_item = en_val[i] if i < len(en_val) else None
            out_list.append(translate_pairs_in_parallel(item, en_item, translator, rules, path_keys=path_keys))
        return out_list

    # Strings
    if isinstance(ar_val, str) and isinstance(en_val, str):
        current_key = path_keys[-1] if path_keys else None
        parent_path = path_keys[:-1] if path_keys else []
        if should_exclude_translation(parent_path, current_key, rules):
            return ar_val

        # If the Arabic locale already contains Arabic characters, keep it as-is
        # to avoid overwriting previously curated translations.
        if ARABIC_CHARS_RE.search(ar_val or ""):
            return ar_val

        # Keep product/app name untouched if it is identical in EN and already in AR.
        if en_val == "Omnex Display Hub":
            return ar_val

        return translator.translate(en_val)

    # If EN is missing but AR is string, keep AR as-is.
    if isinstance(ar_val, str) and (en_val is None or not isinstance(en_val, str)):
        current_key = path_keys[-1] if path_keys else None
        parent_path = path_keys[:-1] if path_keys else []
        if should_exclude_translation(parent_path, current_key, rules):
            return ar_val
        return ar_val

    # For all other scalars/structures, keep AR as-is.
    return ar_val


def main() -> int:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    locales_dir = os.path.join(repo_root, "locales")
    en_dir = os.path.join(locales_dir, "en")
    ar_dir = os.path.join(locales_dir, "ar")

    files: List[str] = [
        os.path.join(ar_dir, "common.json"),
    ]
    pages_dir = os.path.join(ar_dir, "pages")
    for name in os.listdir(pages_dir):
        if name.endswith(".json"):
            files.append(os.path.join(pages_dir, name))

    # Optional CLI filter:
    #   python scripts/i18n_translate_ar.py pages/settings.json
    #   python scripts/i18n_translate_ar.py common.json pages/products.json
    only_rels = set(a.strip().replace("\\", "/") for a in sys.argv[1:] if a.strip())
    if only_rels:
        files = [p for p in files if os.path.relpath(p, ar_dir).replace("\\", "/") in only_rels]

    sleep_sec = float(os.environ.get("I18N_TRANSLATE_SLEEP_SEC", "0.03"))
    tr = Translator(sleep_sec=sleep_sec)
    rules = ExcludeRules()

    changed = 0
    print(f"Starting i18n translate (en -> ar). Files: {len(files)}. Sleep: {sleep_sec}s", flush=True)
    for ar_path in files:
        rel = os.path.relpath(ar_path, ar_dir).replace("\\", "/")
        en_path = os.path.join(en_dir, rel.replace("/", os.sep))
        if not os.path.exists(en_path):
            print(f"SKIP (no EN): {ar_path}", flush=True)
            continue

        print(f"Processing: {rel}", flush=True)
        ar_obj = load_json_pairs(ar_path)
        en_obj = load_json_pairs(en_path)
        new_ar = translate_pairs_in_parallel(ar_obj, en_obj, tr, rules)

        new_text = dump_json_pairs(new_ar, indent=4)
        with open(ar_path, "w", encoding="utf-8", newline="\n") as f:
            f.write(new_text)

        changed += 1
        print(f"UPDATED: {ar_path}", flush=True)

    print(f"Done. Updated {changed} file(s). Cache size: {len(tr.cache)}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


