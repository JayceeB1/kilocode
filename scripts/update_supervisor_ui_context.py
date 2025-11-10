#!/usr/bin/env python3
"""Convenience wrapper to refresh LLM context snapshots for supervisor UI code."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Iterable, Sequence

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent

if str(SCRIPT_DIR) not in sys.path:
	# Allow importing helpers that live alongside this script without packaging friction.
	sys.path.insert(0, str(SCRIPT_DIR))

from generate_supervisor_context import (  # type: ignore  # noqa: E402
	DEFAULT_EXCLUDE_DIRS,
	DEFAULT_EXTENSIONS,
	build_context_for_directory,
)

DEFAULT_DIRECTORIES: Sequence[Path] = (
	Path("webview-ui/src/components"),
	Path("webview-ui/src/state"),
	Path("webview-ui/src/utils"),
	Path("src/core/webview"),
)


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser(
		description="Rebuild the llm-context snapshots for the Supervisor UI surfaces.",
	)
	parser.add_argument(
		"directories",
		nargs="*",
		type=Path,
		help="Directories (relative to --root) to summarize. Defaults to Supervisor UI folders.",
	)
	parser.add_argument(
		"--root",
		type=Path,
		default=REPO_ROOT,
		help="Repository root relative to which directories and outputs are resolved.",
	)
	parser.add_argument(
		"--output-dir",
		type=Path,
		default=REPO_ROOT / "llm-context",
		help="Destination directory for the generated context files.",
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
		"--allow-hidden",
		action="store_true",
		help="Include dotfiles and dot-directories while scanning.",
	)
	return parser.parse_args()


def resolve_directories(root: Path, directories: Sequence[Path]) -> Iterable[tuple[Path, Path]]:
	for directory in directories:
		if directory.is_absolute():
			absolute = directory
			try:
				relative = directory.relative_to(root)
			except ValueError:
				relative = directory
		else:
			relative = directory
			absolute = (root / directory).resolve()
		yield relative, absolute


def main() -> None:
	args = parse_args()
	rel_directories = args.directories or DEFAULT_DIRECTORIES
	allowed_exts = {ext.lower() for ext in DEFAULT_EXTENSIONS}
	excluded_dirs = set(DEFAULT_EXCLUDE_DIRS)

	for rel_path, absolute in resolve_directories(args.root, rel_directories):
		output_name = f"{rel_path.name}-context.txt"
		output_path = args.output_dir / output_name
		build_context_for_directory(
			root=absolute,
			output_path=output_path,
			max_file_chars=args.max_file_chars,
			max_total_chars=args.max_total_chars,
			excluded_dirs=excluded_dirs,
			allowed_exts=allowed_exts,
			allow_hidden=args.allow_hidden,
			encoding="utf-8",
			display_name=str(rel_path),
		)
		print(f"Wrote {output_path}")


if __name__ == "__main__":
	main()

