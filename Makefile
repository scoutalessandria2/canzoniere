.PHONY: editor reader build events export-chordpro-config rhythm rhythm-test

editor:
	cd editor && npm run dev

reader:
	cd reader && npm run dev

build:
	@rm -f canzoniere.pdf
	docker run -v ${PWD}:/data -w /data chordpro/chordpro:latest chordpro canzoni/**/*.cho --output=canzoniere.pdf --config=modern3 --transcode=latin --config=chordpro.json --front-matter=front.pdf --back-matter=back.pdf

events:
	@rm -f canzonieri/*.pdf
	cd printer && go build -o printer .
	@for f in canzonieri/*.txt; do \
		out=$${f%.txt}.pdf; \
		echo "Building $$out"; \
		./printer/printer -input=$$f -output=$$out -songs=canzoni; \
	done

export-chordpro-config:
	@rm -f canzoniere.pdf
	docker run -v ${PWD}:/data -w /data chordpro/chordpro:latest chordpro --config=modern3 --config=chordpro.json --print-final-config > config.json

RHYTHM_PYTHON ?= python3.14

# Each virtual environment is rebuilt when its requirements file is newer than
# its .installed stamp (or the stamp is missing); a failed install removes it.
# ARGS goes to the engine as it is, e.g. ARGS=--reanalyze.
rhythm:
	@test -n "$(SONG)" || { echo "uso: make rhythm SONG=categoria/canzone.cho [ARGS=--reanalyze]"; exit 1; }
	@command -v $(RHYTHM_PYTHON) >/dev/null || { echo "serve Python 3.14: brew install python@3.14"; exit 1; }
	@test rhythm/.venv/.installed -nt rhythm/requirements.txt || { rm -rf rhythm/.venv && $(RHYTHM_PYTHON) -m venv rhythm/.venv && rhythm/.venv/bin/pip install -q -r rhythm/requirements.txt && touch rhythm/.venv/.installed; } || { rm -rf rhythm/.venv; exit 1; }
	cd rhythm && .venv/bin/python -m engine $(SONG) $(ARGS)

rhythm-test:
	@test rhythm/.venv-test/.installed -nt rhythm/requirements-test.txt || { rm -rf rhythm/.venv-test && $(RHYTHM_PYTHON) -m venv rhythm/.venv-test && rhythm/.venv-test/bin/pip install -q -r rhythm/requirements-test.txt && touch rhythm/.venv-test/.installed; } || { rm -rf rhythm/.venv-test; exit 1; }
	rhythm/.venv-test/bin/python -m pytest rhythm/tests -q
