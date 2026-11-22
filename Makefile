.PHONY: verify test bootstrap hooks clean help

help:
	@echo "Available commands:"
	@echo "  make verify     - Run harness and full test suite"
	@echo "  make test       - Alias to run tests"
	@echo "  make bootstrap  - Interactive repository setup"
	@echo "  make hooks      - Install local git hooks"
	@echo "  make clean      - Clean cache and temporary files"

verify:
	python scripts/harness.py
	python -m unittest discover -s tests -v

test: verify

bootstrap:
	python scripts/bootstrap.py

hooks:
	python scripts/install-hooks.py

clean:
	python -c "import pathlib, shutil; [shutil.rmtree(p) for p in pathlib.Path('.').rglob('__pycache__')]"
	python -c "import pathlib, shutil; [shutil.rmtree(p) for p in pathlib.Path('.').rglob('.pytest_cache')]"
