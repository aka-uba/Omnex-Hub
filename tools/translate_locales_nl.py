import json
import os
import re
import time
import argparse
from typing import Any, Dict, List, Tuple

from deep_translator import GoogleTranslator  # type: ignore


PLACEHOLDER_RE = re.compile(r"\{[^}]+\}")


def protect_placeholders(text: str) -> Tuple[str, Dict[str, str]]:
    """
    Replace {placeholders} with stable tokens to avoid translation altering them.
    """
    mapping: Dict[str, str] = {}
    out = text
    idx = 0
    for m in PLACEHOLDER_RE.finditer(text):
        ph = m.group(0)
        token = f"__PH_{idx}__"
        idx += 1
        mapping[token] = ph
        out = out.replace(ph, token)
    return out, mapping


def restore_placeholders(text: str, mapping: Dict[str, str]) -> str:
    out = text
    for token, ph in mapping.items():
        out = out.replace(token, ph)
    return out


def iter_strings(obj: Any, path: Tuple[str, ...] = ()) -> List[Tuple[Tuple[str, ...], str]]:
    found: List[Tuple[Tuple[str, ...], str]] = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            found.extend(iter_strings(v, path + (str(k),)))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            found.extend(iter_strings(v, path + (str(i),)))
    elif isinstance(obj, str):
        found.append((path, obj))
    return found


def set_by_path(obj: Any, path: Tuple[str, ...], value: str) -> None:
    cur = obj
    for p in path[:-1]:
        if isinstance(cur, list):
            cur = cur[int(p)]
        else:
            cur = cur[p]
    last = path[-1]
    if isinstance(cur, list):
        cur[int(last)] = value
    else:
        cur[last] = value


def translate_many(texts: List[str], src: str, dest: str) -> List[str]:
    """
    Translate many strings in batches, keeping order.
    Uses deep-translator (Google web translate) under the hood.
    """
    out: List[str] = []
    chunk_size = 50
    translator = GoogleTranslator(source=src, target=dest)

    for i in range(0, len(texts), chunk_size):
        chunk = texts[i : i + chunk_size]
        for attempt in range(3):
            try:
                translated = translator.translate_batch(chunk)
                if not isinstance(translated, list) or len(translated) != len(chunk):
                    raise RuntimeError("Unexpected translate_batch result")
                out.extend(translated)
                break
            except Exception:
                if attempt == 2:
                    raise
                time.sleep(1.5 + attempt)
    return out


def translate_json_file(
    src_path: str,
    dest_path: str,
    src_lang: str = "en",
    dest_lang: str = "nl",
    skip_paths: List[Tuple[str, ...]] | None = None,
) -> None:
    skip_paths = skip_paths or []

    with open(src_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # If destination exists, we may want to preserve some sections (like languages)
    existing_dest = None
    if os.path.exists(dest_path):
        with open(dest_path, "r", encoding="utf-8") as f:
            try:
                existing_dest = json.load(f)
            except Exception:
                existing_dest = None

    string_entries = iter_strings(data)
    paths: List[Tuple[str, ...]] = []
    texts: List[str] = []
    protections: List[Dict[str, str]] = []

    skip_set = set(skip_paths)
    for p, t in string_entries:
        if p in skip_set:
            continue
        protected, mapping = protect_placeholders(t)
        paths.append(p)
        texts.append(protected)
        protections.append(mapping)

    translated = translate_many(texts, src=src_lang, dest=dest_lang)

    for (p, _orig), tr_text, mapping in zip([(p, t) for p, t in zip(paths, texts)], translated, protections):
        restored = restore_placeholders(tr_text, mapping)
        set_by_path(data, p, restored)

    # Preserve skip_paths from existing destination if available
    if existing_dest is not None:
        for sp in skip_paths:
            # get value at sp in existing_dest and set it on data
            cur = existing_dest
            ok = True
            for part in sp:
                try:
                    if isinstance(cur, list):
                        cur = cur[int(part)]
                    else:
                        cur = cur[part]
                except Exception:
                    ok = False
                    break
            if ok:
                set_by_path(data, sp, cur)  # type: ignore[arg-type]

    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    with open(dest_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
        f.write("\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Translate i18n JSON files from English to Dutch.")
    parser.add_argument(
        "--scope",
        choices=["all", "common", "pages", "deploy"],
        default="all",
        help="What to translate. 'all' = locales + deploy; 'deploy' = deploy only.",
    )
    args = parser.parse_args()

    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

    # Main locales
    src_root = os.path.join(repo_root, "locales", "en")
    dst_root = os.path.join(repo_root, "locales", "nl")

    # Deploy locales (smaller subset)
    deploy_src_root = os.path.join(repo_root, "deploy", "locales", "en")
    deploy_dst_root = os.path.join(repo_root, "deploy", "locales", "nl")

    # Skip header language menu + submenu translations:
    # LanguageSelector uses common.json: languages.selectLanguage and languages.<code>
    skip_common_paths = [
        ("languages",),  # preserve the entire languages block as-is in nl/common.json
    ]

    files_to_translate: List[Tuple[str, str, List[Tuple[str, ...]]]] = []

    if args.scope in ("all", "common"):
        files_to_translate.append(
            (os.path.join(src_root, "common.json"), os.path.join(dst_root, "common.json"), skip_common_paths)
        )

    if args.scope in ("all", "pages"):
        pages_dir = os.path.join(src_root, "pages")
        for name in os.listdir(pages_dir):
            if not name.endswith(".json"):
                continue
            files_to_translate.append(
                (os.path.join(pages_dir, name), os.path.join(dst_root, "pages", name), [])
            )

    # deploy common + pages if present
    if args.scope in ("all", "deploy") and os.path.exists(deploy_src_root):
        deploy_common = os.path.join(deploy_src_root, "common.json")
        if os.path.exists(deploy_common):
            files_to_translate.append(
                (deploy_common, os.path.join(deploy_dst_root, "common.json"), skip_common_paths)
            )
        deploy_pages = os.path.join(deploy_src_root, "pages")
        if os.path.exists(deploy_pages):
            for name in os.listdir(deploy_pages):
                if not name.endswith(".json"):
                    continue
                files_to_translate.append(
                    (os.path.join(deploy_pages, name), os.path.join(deploy_dst_root, "pages", name), [])
                )

    print(f"Translating {len(files_to_translate)} JSON files (en -> nl)...", flush=True)
    ok_count = 0
    fail_count = 0
    for idx, (src_path, dst_path, skip_paths) in enumerate(files_to_translate, start=1):
        rel_src = os.path.relpath(src_path, repo_root)
        rel_dst = os.path.relpath(dst_path, repo_root)
        print(f"[{idx}/{len(files_to_translate)}] {rel_src} -> {rel_dst}", flush=True)
        try:
            translate_json_file(src_path, dst_path, skip_paths=skip_paths)
            ok_count += 1
        except Exception as e:
            fail_count += 1
            print(f"  ERROR: {type(e).__name__}: {e}", flush=True)
            # continue with next file

    print(f"Done. OK={ok_count}, FAIL={fail_count}", flush=True)


if __name__ == "__main__":
    main()


