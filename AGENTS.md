# Browser testing

Run automated browser tests headlessly by default. The user works on this computer during testing: do not open browser windows, steal focus, or flash UI unless they explicitly request a visible debugging session.

The retained browser tests honor `SPACOLOGY_HEADED=1` as an explicit opt-in. Leave it unset for routine tests. Screenshots and traces can be captured headlessly. Apply this preference to new temporary test scripts as well.

Run the tests with `npm test` from the repository root (after `npm install` once). It serves the site on a free port, runs the unit and browser tests one file at a time, and stays headless. `npm test -- <text>` runs only files whose path contains the text. See `tests/browser/README.md`.
