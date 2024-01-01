# Pretty Postgres

Generate beautiful, readable PostgreSQL schemas.

## Installation

Install `pretty-postgres` as a dev dependency.

```
npm install pretty-postgres --save-dev
```

## Usage

Run the cli command to generate a schema in the root of your project.

```
npx pretty-postgres generate -connection-string postgresql://username:password@host:port/db-name -filename output-file -filetype html
```

### Options

| Option               | Required    | Default value          | Aliases     | Description |
| -------------------- | ----------- | ---------------------- | ----------- | ----------- |
| `-connection-string` | Yes         | N/A                    | `-cs`       | A postgres connection string* |
| `-filename`          | No          | pretty-postgres-schema | `-fn`       | The name of the outputted schema file. |
| `-filetype`          | No          | html                   | `-ft`       | Either "txt" or "html". Choosing "txt" will produce a simplified and formatted schema file. "html" is recommended to produce the most powerful and beautiful schema files. |
*The connection string should be formatted as follows: `postgresql://USERNAME:PASSWORD@HOST:PORT/DB_NAME`