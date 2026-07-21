# Should NOT trigger

1. "Fix this one failing test." — single lane; spawn overhead exceeds the work.
2. "Walk me through this file and explain it." — interactive inline work; no decomposition.
3. "Step 1 produces the schema, step 2 migrates data with it, step 3 validates." — strictly
   sequential dependency chain; parallelization test fails by design.
