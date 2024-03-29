# Steps
1. Make models in `mra-db-schemas` project
2. Copy models to this folder
3. Update `'(now() AT TIME ZONE UTC'` to `"(now() AT TIME ZONE 'UTC')"`