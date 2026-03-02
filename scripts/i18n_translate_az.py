import argparse
import json
import os
import re
import sys
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from deep_translator import GoogleTranslator  # type: ignore


PairObject = List[Tuple[str, Any]]  # JSON object represented as list of (key, value) pairs (keeps order + duplicates)


def is_pair_object(v: Any) -> bool:
    return isinstance(v, list) and (len(v) == 0 or all(isinstance(x, tuple) and len(x) == 2 and isinstance(x[0], str) for x in v))


def load_json_pairs(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    return json.loads(text, object_pairs_hook=list)


def _json_dumps_str(s: str) -> str:
    # Use json.dumps for proper escaping, but keep unicode characters.
    return json.dumps(s, ensure_ascii=False)


def dump_json_pairs(value: Any, indent: int = 4) -> str:
    def _dump(v: Any, level: int) -> str:
        pad = " " * (indent * level)
        pad_in = " " * (indent * (level + 1))

        if is_pair_object(v):
            if not v:
                return "{}"
            parts: List[str] = ["{"]  # opening brace
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
        # Use a token unlikely to be translated/modified
        return f"[[PH{len(placeholders)-1}]]"

    protected = PH_RE.sub(_repl, s)
    return protected, placeholders


def restore_placeholders(s: str, placeholders: List[str]) -> str:
    out = s
    for i, ph in enumerate(placeholders):
        out = out.replace(f"[[PH{i}]]", ph)
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
    def __init__(self, sleep_sec: float = 0.0, batch_size: int = 25, max_retries: int = 3):
        self.t = GoogleTranslator(source="en", target="az")
        self.cache: Dict[str, str] = {}
        self.sleep_sec = sleep_sec
        self.batch_size = batch_size
        self.max_retries = max_retries

    def _translate_one_protected(self, protected: str) -> str:
        last_err: Optional[BaseException] = None
        for attempt in range(self.max_retries):
            try:
                return self.t.translate(protected)
            except BaseException as e:
                last_err = e
                time.sleep(0.5 * (attempt + 1))
        assert last_err is not None
        raise last_err

    def translate_many(self, texts: List[str]) -> Dict[str, str]:
        """
        Translate unique EN texts -> AZ. Returns mapping original_text -> translated_text.
        Keeps an internal cache.
        """
        out: Dict[str, str] = {}
        # Filter uniques not in cache
        to_do = [t for t in texts if t not in self.cache]
        if not to_do:
            for t in texts:
                out[t] = self.cache[t]
            return out

        # Prepare protected strings and placeholder maps
        protected_list: List[str] = []
        placeholder_lists: List[List[str]] = []
        original_list: List[str] = []
        for t in to_do:
            protected, placeholders = protect_placeholders(t)
            original_list.append(t)
            protected_list.append(protected)
            placeholder_lists.append(placeholders)

        total = len(protected_list)
        for start in range(0, total, self.batch_size):
            chunk_protected = protected_list[start : start + self.batch_size]
            chunk_original = original_list[start : start + self.batch_size]
            chunk_placeholders = placeholder_lists[start : start + self.batch_size]

            # Try batch translate first; fallback to one-by-one on failure.
            translated_chunk: List[str]
            try:
                translated_chunk = self.t.translate_batch(chunk_protected)  # type: ignore[attr-defined]
                if not isinstance(translated_chunk, list) or len(translated_chunk) != len(chunk_protected):
                    raise RuntimeError("translate_batch returned unexpected result")
            except BaseException:
                translated_chunk = [self._translate_one_protected(p) for p in chunk_protected]

            for orig, trans, phs in zip(chunk_original, translated_chunk, chunk_placeholders):
                restored = restore_placeholders(trans, phs)
                self.cache[orig] = restored
                out[orig] = restored

            if self.sleep_sec:
                time.sleep(self.sleep_sec)

        # Fill outputs for any already-cached duplicates
        for t in texts:
            out[t] = self.cache[t]
        return out

    def translate(self, text: str) -> str:
        text = text.strip("\ufeff")
        if text == "":
            return text
        if text in self.cache:
            return self.cache[text]
        m = self.translate_many([text])
        return m[text]


def collect_translatable_en_strings(
    az_val: Any,
    en_val: Any,
    rules: ExcludeRules,
    path_keys: Optional[List[str]] = None,
) -> Any:
    if path_keys is None:
        path_keys = []

    # Objects (pair-list)
    if is_pair_object(az_val) and is_pair_object(en_val):
        # Prefer parallel traversal by index to preserve duplicates and ordering.
        # If keys mismatch (shouldn't), fallback to key-based lookup for that item.
        en_pairs: PairObject = en_val
        az_pairs: PairObject = az_val

        def en_lookup_first(key: str) -> Optional[Any]:
            for k, v in en_pairs:
                if k == key:
                    return v
            return None

        collected: List[str] = []
        for idx, (az_k, az_v) in enumerate(az_pairs):
            en_k = en_pairs[idx][0] if idx < len(en_pairs) else None
            en_v = en_pairs[idx][1] if idx < len(en_pairs) else en_lookup_first(az_k)
            # If index-aligned key differs, still try key-based.
            if en_k is not None and en_k != az_k:
                en_v = en_lookup_first(az_k)
            collected.extend(
                collect_translatable_en_strings(
                    az_v,
                    en_v,
                    rules,
                    path_keys=path_keys + [az_k],
                )
            )
        return collected

    # Arrays
    if isinstance(az_val, list) and not is_pair_object(az_val) and isinstance(en_val, list) and not is_pair_object(en_val):
        collected: List[str] = []
        for i, item in enumerate(az_val):
            en_item = en_val[i] if i < len(en_val) else None
            collected.extend(
                collect_translatable_en_strings(item, en_item, rules, path_keys=path_keys)
            )
        return collected

    # Strings
    if isinstance(az_val, str) and isinstance(en_val, str):
        current_key = path_keys[-1] if path_keys else None
        parent_path = path_keys[:-1] if path_keys else []
        if should_exclude_translation(parent_path, current_key, rules):
            return []

        # Keep product/brand name untouched if it is identical in EN and AZ already
        if en_val == "Omnex Display Hub":
            return []

        return [en_val]

    # If EN is missing but AZ is string, translate AZ as fallback (still from EN-ish language; better than nothing)
    if isinstance(az_val, str) and (en_val is None or not isinstance(en_val, str)):
        return []

    # For all other scalars/structures, keep AZ as-is.
    return []


def apply_translations_from_en(
    az_val: Any,
    en_val: Any,
    translated_map: Dict[str, str],
    rules: ExcludeRules,
    path_keys: Optional[List[str]] = None,
) -> Any:
    if path_keys is None:
        path_keys = []

    if is_pair_object(az_val) and is_pair_object(en_val):
        out: PairObject = []
        en_pairs: PairObject = en_val
        az_pairs: PairObject = az_val

        def en_lookup_first(key: str) -> Optional[Any]:
            for k, v in en_pairs:
                if k == key:
                    return v
            return None

        for idx, (az_k, az_v) in enumerate(az_pairs):
            en_k = en_pairs[idx][0] if idx < len(en_pairs) else None
            en_v = en_pairs[idx][1] if idx < len(en_pairs) else en_lookup_first(az_k)
            if en_k is not None and en_k != az_k:
                en_v = en_lookup_first(az_k)
            out.append(
                (
                    az_k,
                    apply_translations_from_en(
                        az_v,
                        en_v,
                        translated_map,
                        rules,
                        path_keys=path_keys + [az_k],
                    ),
                )
            )
        return out

    if isinstance(az_val, list) and not is_pair_object(az_val) and isinstance(en_val, list) and not is_pair_object(en_val):
        out_list: List[Any] = []
        for i, item in enumerate(az_val):
            en_item = en_val[i] if i < len(en_val) else None
            out_list.append(apply_translations_from_en(item, en_item, translated_map, rules, path_keys=path_keys))
        return out_list

    if isinstance(az_val, str) and isinstance(en_val, str):
        current_key = path_keys[-1] if path_keys else None
        parent_path = path_keys[:-1] if path_keys else []
        if should_exclude_translation(parent_path, current_key, rules):
            return az_val
        if en_val == "Omnex Display Hub":
            return az_val
        return translated_map.get(en_val, az_val)

    return az_val


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", default=None, help="Optional list of relative locale file paths under locales/az (e.g. common.json pages/dashboard.json)")
    ap.add_argument("--log-every", type=int, default=250, help="Progress print interval (unique strings)")
    args = ap.parse_args()

    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    locales_dir = os.path.join(repo_root, "locales")
    en_dir = os.path.join(locales_dir, "en")
    az_dir = os.path.join(locales_dir, "az")

    if args.only:
        files = [os.path.join(az_dir, p.replace("/", os.sep)) for p in args.only]
    else:
        files = [os.path.join(az_dir, "common.json")]
        pages_dir = os.path.join(az_dir, "pages")
        for name in os.listdir(pages_dir):
            if name.endswith(".json"):
                files.append(os.path.join(pages_dir, name))

    rules = ExcludeRules()
    tr = Translator(batch_size=25, max_retries=3, sleep_sec=0.0)

    changed = 0
    for az_path in files:
        rel = os.path.relpath(az_path, az_dir).replace("\\", "/")
        en_path = os.path.join(en_dir, rel.replace("/", os.sep))
        if not os.path.exists(en_path):
            print(f"SKIP (no EN): {az_path}")
            continue

        az_obj = load_json_pairs(az_path)
        en_obj = load_json_pairs(en_path)
        en_strings = collect_translatable_en_strings(az_obj, en_obj, rules)
        # Unique strings only (stable order)
        seen: set[str] = set()
        uniq: List[str] = []
        for s in en_strings:
            if s not in seen:
                seen.add(s)
                uniq.append(s)

        print(f"[{rel}] unique strings to translate: {len(uniq)}")
        translated_map: Dict[str, str] = {}
        if uniq:
            # Translate in chunks with periodic progress
            for start in range(0, len(uniq), tr.batch_size):
                chunk = uniq[start : start + tr.batch_size]
                translated_map.update(tr.translate_many(chunk))
                if args.log_every and (start + len(chunk)) % args.log_every == 0:
                    print(f"[{rel}] translated {start + len(chunk)} / {len(uniq)} unique strings")
                    sys.stdout.flush()

        new_az = apply_translations_from_en(az_obj, en_obj, translated_map, rules)

        new_text = dump_json_pairs(new_az, indent=4)
        with open(az_path, "w", encoding="utf-8", newline="\n") as f:
            f.write(new_text)

        changed += 1
        print(f"UPDATED: {az_path}")

    print(f"Done. Updated {changed} file(s). Cache size: {len(tr.cache)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


