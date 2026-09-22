# Browser testing

Run automated browser tests headlessly by default. The user works on this computer during testing: do not open browser windows, steal focus, or flash UI unless they explicitly request a visible debugging session.

The retained browser tests honor `SPACOLOGY_HEADED=1` as an explicit opt-in. Leave it unset for routine tests. Screenshots and traces can be captured headlessly. Apply this preference to new temporary test scripts as well.
