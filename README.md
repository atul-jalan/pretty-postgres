# Pretty Postgres

Generate beautiful, powerful PostgreSQL schema visualizations.

## Installation

Install `pretty-postgres` as a global dependency.

```bash
npm install pretty-postgres --global
```

Alternatively, you can install `pretty-postgres` as a local dependency to your project.

```bash
npm install pretty-postgres --save-dev
```

## Usage

Run the cli command to generate a schema in the root of your project.

```bash
pretty-postgres generate -connection-string postgresql://username:password@host:port/db-name -filename output-file -filetype html
```

If installed locally, you may need to prefix the cli command with `npx`.

### Options

| Option               | Required | Default value          | Aliases | Description                                                                                                                                                                |
| -------------------- | -------- | ---------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `-connection-string` | Yes      | N/A                    | `-cs`   | A postgres connection string\*                                                                                                                                             |
| `-filename`          | No       | pretty-postgres-schema | `-fn`   | The name of the outputted schema file.                                                                                                                                     |
| `-filetype`          | No       | html                   | `-ft`   | Either "txt" or "html". Choosing "txt" will produce a simplified and formatted schema file. "html" is recommended to produce the most powerful and beautiful schema files. |

\*The connection string should be formatted as follows: `postgresql://USERNAME:PASSWORD@HOST:PORT/DB_NAME`
