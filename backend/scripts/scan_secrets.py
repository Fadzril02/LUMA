import os
import re

ignore_dirs = {'.git', 'node_modules', 'dist', '.pytest_cache', '__pycache__', 'scratch'}
patterns = [
    (re.compile(r'eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}'), 'JWT Token'),
    (re.compile(r'sk-[a-zA-Z0-9]{20,}'), 'OpenAI Secret Key'),
    (re.compile(r'gsk_[a-zA-Z0-9]{20,}'), 'Groq Secret Key'),
    (re.compile(r'postgres://[^:]+:[^@]+@'), 'Postgres Connection String with Password'),
    (re.compile(r'(?i)(api[_-]?key|secret|password)\s*[:=]\s*["\'][^"\']{8,}["\']'), 'Hardcoded secret/password')
]

matches = []
for root, dirs, files in os.walk(r'd:\smart-aa-system'):
    dirs[:] = [d for d in dirs if d not in ignore_dirs]
    for f in files:
        if f in {'.env', '.env.local', 'package-lock.json'} or f.endswith(('.png', '.webp', '.jpg', '.ico', '.woff', '.woff2')):
            continue
        filepath = os.path.join(root, f)
        relpath = os.path.relpath(filepath, r'd:\smart-aa-system')
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as file:
                lines = file.readlines()
            for line_idx, line in enumerate(lines, 1):
                clean_line = line.strip()
                # Skip HTML template type="password", placeholder etc.
                if 'type="password"' in clean_line or 'autoComplete=' in clean_line:
                    continue
                for pat, desc in patterns:
                    if pat.search(clean_line):
                        matches.append((relpath, line_idx, desc, clean_line))
                        break
        except Exception:
            pass

print(f"Total secret pattern findings: {len(matches)}")
for relpath, line_idx, desc, line in matches:
    print(f"{relpath}:{line_idx} [{desc}] -> {line[:140]}")
