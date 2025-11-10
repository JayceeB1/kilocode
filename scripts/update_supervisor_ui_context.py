#!/usr/bin/env python3
"""Convenience wrapper to refresh LLM context snapshots for supervisor UI code."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Dict, Iterable, List, Sequence

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent

if str(SCRIPT_DIR) not in sys.path:
	# Allow importing helpers that live alongside this script without packaging friction.
	sys.path.insert(0, str(SCRIPT_DIR))

from generate_supervisor_context import (  # type: ignore  # noqa: E402
	DEFAULT_EXCLUDE_DIRS,
	DEFAULT_EXTENSIONS,
	build_context_for_directory,
	build_context_from_text_blocks,
	collect_file_blocks,
)

GROUP_DEFINITION: Dict[str, Dict[str, Sequence[Path]]] = {
	"components": {
		"files": (
			Path("webview-ui/src/components/settings/LocalSupervisor.tsx"),
			Path("webview-ui/src/components/settings/__tests__/LocalSupervisor.spec.tsx"),
			Path("webview-ui/src/components/chat/ToolbarSupervisorToggle.tsx"),
			Path("webview-ui/src/components/chat/__tests__/ToolbarSupervisorToggle.spec.tsx"),
		),
	},
	"state": {
		"files": (
			Path("webview-ui/src/state/supervisorSlice.ts"),
			Path("webview-ui/src/state/__tests__/supervisorSlice.spec.tsx"),
			Path("webview-ui/src/state/patcherSlice.ts"),
			Path("webview-ui/src/state/__tests__/patcherSlice.spec.tsx"),
		),
	},
	"utils": {
		"files": (
			Path("webview-ui/src/utils/patchBridge.ts"),
			Path("webview-ui/src/utils/__tests__/patchBridge.spec.ts"),
		),
	},
	"webview": {
		"files": (
			Path("src/shared/WebviewMessage.ts"),
			Path("src/shared/ExtensionMessage.ts"),
		),
		"snippets": (
			Path("src/core/webview/webviewMessageHandler.ts"),
		),
	},
	"docs": {
		"files": (
			Path("README_SUPERVISOR.md"),
			Path(".kilocode/supervisor.config.json.example"),
		),
	},
}


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser(
		description="Rebuild the llm-context snapshots for the Supervisor UI surfaces.",
	)
	parser.add_argument(
		"directories",
		nargs="*",
		type=Path,
		help="Optional: summarize these directories verbatim (bypasses group filtering).",
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
	parser.add_argument(
		"--groups",
		nargs="*",
		choices=sorted(GROUP_DEFINITION.keys()),
		help="Subset of supervisor UI groups to refresh (default: all). Ignored if directories are passed.",
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


def extract_snippet(path: Path, keyword: str = "supervisor", context_lines: int = 40, max_matches: int = 6) -> str:
	if not path.exists():
		return f"(file not found: {path})"

	lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
	if not lines:
		return "(file empty)"

	matches: List[str] = []
	last_end = -1
	keyword_lower = keyword.lower()

	for idx, line in enumerate(lines):
		if keyword_lower not in line.lower():
			continue
		start = max(0, idx - context_lines)
		if start <= last_end:
			start = last_end
		end = min(len(lines), idx + context_lines + 1)
		snippet = "\n".join(lines[start:end])
		matches.append(f"// Lines {start + 1}-{end}\n{snippet}")
		last_end = end
		if max_matches and len(matches) >= max_matches:
			break

	if not matches:
		return "(no matching lines found)"

	return "\n\n".join(matches)


def main() -> None:
	args = parse_args()
	allowed_exts = {ext.lower() for ext in DEFAULT_EXTENSIONS}
	excluded_dirs = set(DEFAULT_EXCLUDE_DIRS)

	# Legacy mode: user passed explicit directories
	if args.directories:
		for rel_path, absolute in resolve_directories(args.root, args.directories):
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
		return

	selected_groups = args.groups or list(GROUP_DEFINITION.keys())
	for group_name in selected_groups:
		config = GROUP_DEFINITION[group_name]
		files = [args.root / path for path in config.get("files", ())]
		blocks = collect_file_blocks(
			files=files,
			max_file_chars=args.max_file_chars,
			encoding="utf-8",
			relative_to=args.root,
		)

		for snippet_path in config.get("snippets", ()):
			full_path = (args.root / snippet_path).resolve()
			snippet_body = extract_snippet(full_path)
			blocks.append((f"{snippet_path} (supervisor excerpts)", snippet_body))

		if not blocks:
			print(f"[context] No files/snippets found for group '{group_name}', skipping.")
			continue

		output_path = args.output_dir / f"{group_name}-context.txt"
		build_context_from_text_blocks(
			blocks=blocks,
			output_path=output_path,
			max_total_chars=args.max_total_chars,
			encoding="utf-8",
			display_name=f"Supervisor UI {group_name}",
			max_file_chars=args.max_file_chars,
		)
		print(f"Wrote {output_path}")


if __name__ == "__main__":
	main()
