#!/usr/bin/env python3
"""Build condensed context files from source directories for LLM ingestion."""
from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import Iterable, List, Set

# Default extensions/sample directories capture the common text surfaces in the repo.
DEFAULT_EXTENSIONS: Set[str] = {
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".json",
    ".jsonc",
    ".md",
    ".mdx",
    ".yml",
    ".yaml",
    ".toml",
    ".lock",
    ".ini",
    ".env",
    ".sh",
    ".py",
    ".rs",
    ".go",
    ".java",
    ".kt",
    ".gradle",
    ".rb",
    ".php",
    ".html",
    ".css",
    ".scss",
    ".less",
    ".sql",
    ".txt",
}

DEFAULT_EXCLUDE_DIRS: Set[str] = {
    ".git",
    ".idea",
    ".vscode",
    "node_modules",
    "dist",
    "build",
    "coverage",
    "out",
    "tmp",
    "__pycache__",
    "logs",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Aggregate textual context per directory into standalone files."
    )
    parser.add_argument(
        "directories",
        nargs="+",
        type=Path,
        help="Directories to summarize (one output file per directory).",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("llm-context"),
        help="Directory where the synthesized context files will be written.",
    )
    parser.add_argument(
        "--max-file-chars",
        type=int,
        default=4000,
        help="Maximum number of characters captured per file before truncation.",
    )
    parser.add_argument(
        "--max-total-chars",
        type=int,
        default=160_000,
        help="Maximum number of characters per context file (0 disables the cap).",
    )
    parser.add_argument(
        "--include-ext",
        nargs="*",
        default=sorted(DEFAULT_EXTENSIONS),
        help="Explicit list of file extensions to keep (prefix with '.'), use '*' for all.",
    )
    parser.add_argument(
        "--exclude-dirs",
        nargs="*",
        default=sorted(DEFAULT_EXCLUDE_DIRS),
        help="Directory names to skip during traversal.",
    )
    parser.add_argument(
        "--allow-hidden",
        action="store_true",
        help="Include dotfiles and directories (hidden paths).",
    )
    parser.add_argument(
        "--encoding",
        default="utf-8",
        help="Default encoding used when reading text files.",
    )
    return parser.parse_args()


def should_skip_dir(dirname: str, excluded: Set[str], allow_hidden: bool) -> bool:
    if dirname in excluded:
        return True
    if not allow_hidden and dirname.startswith('.'):
        return True
    return False


def should_keep_file(path: Path, allowed_exts: Set[str], allow_hidden: bool) -> bool:
    if not allow_hidden and any(part.startswith('.') for part in path.parts):
        return False
    if '*' in allowed_exts:
        return True
    suffix = path.suffix.lower()
    if suffix in allowed_exts:
        return True
    # Allow special-case filenames without extensions
    special = {"Dockerfile", "Makefile", "README", "LICENSE"}
    return path.name in special


def iter_files(root: Path, excluded_dirs: Set[str], allowed_exts: Set[str], allow_hidden: bool) -> Iterable[Path]:
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [
            name
            for name in dirnames
            if not should_skip_dir(name, excluded_dirs, allow_hidden)
        ]
        current = Path(dirpath)
        for filename in sorted(filenames):
            candidate = current / filename
            if not should_keep_file(candidate.relative_to(root), allowed_exts, allow_hidden):
                continue
            yield candidate


def read_file(path: Path, encoding: str, max_chars: int) -> tuple[str, bool]:
    try:
        text = path.read_text(encoding=encoding, errors="ignore")
    except Exception as exc:  # pragma: no cover - defensive logging only
        return f"<unable to read {path}: {exc}>", False
    truncated = False
    if max_chars and len(text) > max_chars:
        text = text[: max_chars - 1] + "\n…[truncated]"
        truncated = True
    return text, truncated


def build_context_for_directory(
    root: Path,
    output_path: Path,
    max_file_chars: int,
    max_total_chars: int,
    excluded_dirs: Set[str],
    allowed_exts: Set[str],
    allow_hidden: bool,
    encoding: str,
) -> None:
    if not root.exists() or not root.is_dir():
        raise FileNotFoundError(f"Directory not found: {root}")

    files = list(iter_files(root, excluded_dirs, allowed_exts, allow_hidden))
    lines: List[str] = []
    lines.append(f"# Context digest for {root}")
    lines.append(f"# Files considered: {len(files)}")
    if max_file_chars:
        lines.append(f"# Max chars per file: {max_file_chars}")
    if max_total_chars:
        lines.append(f"# Max chars per digest: {max_total_chars}")
    lines.append("")

    total_chars = sum(len(line) + 1 for line in lines)

    for file_path in files:
        rel_path = file_path.relative_to(root)
        header = f"===== {rel_path} =====\n"
        body, truncated = read_file(file_path, encoding, max_file_chars)
        footer = "\n"
        if truncated:
            footer = "\n# note: truncated to stay within per-file budget\n\n"
        block = header + body + footer
        if max_total_chars and total_chars + len(block) > max_total_chars:
            lines.append("# --- reached max_total_chars budget; stopping early ---")
            break
        lines.append(block)
        total_chars += len(block)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("".join(lines), encoding="utf-8")


def main() -> None:
    args = parse_args()
    allowed_exts = {ext.lower() for ext in args.include_ext}
    excluded_dirs = set(args.exclude_dirs)

    for directory in args.directories:
        output_dir = args.output_dir
        out_filename = f"{directory.name}-context.txt"
        output_path = output_dir / out_filename
        build_context_for_directory(
            root=directory,
            output_path=output_path,
            max_file_chars=args.max_file_chars,
            max_total_chars=args.max_total_chars,
            excluded_dirs=excluded_dirs,
            allowed_exts=allowed_exts,
            allow_hidden=args.allow_hidden,
            encoding=args.encoding,
        )
        print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
