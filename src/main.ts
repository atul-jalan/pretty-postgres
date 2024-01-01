#!/usr/bin/env node
import pg from "pg";
import fs from "fs";

import {
    getFormattedDateTimeString,
    getHTMLStyles,
    getScript,
    insertSpan,
} from "./utils.js";

type FileType = "txt" | "html";

const COLUMN_PADDING = 2;
const DEFAULT_FILE_TYPE: FileType = "html";
const DEFAULT_FILE_NAME = "pretty-postgres-schema";

function main(): void {
    const command = process.argv[2];

    if (command === "generate") {
        const additionalArgs = process.argv.slice(3);

        let connectionString: string | null = null;
        let filename: string | null = null;
        let filetype: FileType | null = null;

        for (let i = 0; i < additionalArgs.length; i += 1) {
            const arg = additionalArgs[i];

            if (i === additionalArgs.length - 1) {
                continue;
            }

            if (arg === "-connection-string" || arg === "-cs") {
                connectionString = additionalArgs[i + 1];
                i += 1;
            } else if (arg === "-filename" || arg === "-fn") {
                filename = additionalArgs[i + 1];
                i += 1;
            } else if (arg === "-filetype" || arg === "-ft") {
                const inputtedFileType = additionalArgs[i + 1];
                if (inputtedFileType === "html" || inputtedFileType === "txt") {
                    filetype = inputtedFileType;
                } else {
                    console.log(
                        `Error: ${inputtedFileType} is not a valid file type.`,
                    );
                    return;
                }
                i += 1;
            }
        }

        const selectedFileName = filename || DEFAULT_FILE_NAME;
        const selectedFileType = filetype || DEFAULT_FILE_TYPE;

        if (connectionString === null) {
            console.log(
                "Error: you must provide a connection string with the -connection-string or -cs flag.",
            );
            return;
        }

        if (filename === null) {
            console.log(
                `Writing schema to ${selectedFileName}.${selectedFileType}.`,
            );
            console.log(
                "You can optionally specify a filename with the -filename or -f flag.",
            );
        }

        generate(connectionString, selectedFileName, selectedFileType);
    } else {
        console.log("Error: command not recognized.\n");
    }
    return;
}

async function generate(
    connectionString: string,
    filename: string,
    fileType: "txt" | "html",
): Promise<void> {
    const openCurlyBracket = insertSpan("punctuation", "{", fileType);
    const closeCurlyBracket = insertSpan("punctuation", "}", fileType);

    const pool = new pg.Pool({
        connectionString: connectionString,
    });

    const client = await pool.connect();

    try {
        const columnsRes = await client.query(`
        SELECT 
            cols.table_name,
            cols.column_name,
            cols.data_type,
            cols.udt_name,
            cols.column_default,
            cols.is_nullable,
            tc.constraint_type,
            CASE WHEN tc.constraint_type = 'FOREIGN KEY' 
                THEN ccu.table_name
            ELSE NULL
            END AS foreign_key_table,
            CASE WHEN tc.constraint_type = 'FOREIGN KEY' 
                THEN ccu.column_name
            ELSE NULL
            END AS foreign_key_column,
            CASE WHEN tc.constraint_type = 'FOREIGN KEY' 
                THEN rc.delete_rule
            ELSE NULL
            END AS foreign_key_delete_rule,
            CASE WHEN tc.constraint_type = 'FOREIGN KEY' 
                THEN rc.update_rule
            ELSE NULL
            END AS foreign_key_update_rule
        FROM 
            information_schema.columns AS cols
        LEFT JOIN 
            information_schema.key_column_usage AS kcu 
            ON cols.table_name = kcu.table_name 
            AND cols.column_name = kcu.column_name 
            AND cols.table_schema = kcu.table_schema
        LEFT JOIN 
            information_schema.table_constraints AS tc 
            ON kcu.constraint_name = tc.constraint_name 
            AND kcu.table_schema = tc.table_schema 
            AND kcu.table_name = tc.table_name
        LEFT JOIN 
            information_schema.referential_constraints AS rc 
            ON tc.constraint_name = rc.constraint_name 
            AND tc.table_schema = rc.constraint_schema
        LEFT JOIN 
            information_schema.constraint_column_usage AS ccu
            ON rc.constraint_name = ccu.constraint_name
            AND rc.constraint_schema = ccu.constraint_schema
        WHERE 
            cols.table_schema = 'public';
        `);

        const enumsRes = await client.query(`
        SELECT 
            t.typname AS enum_name,
            e.enumlabel AS enum_value
        FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid  
        JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
        `);

        // Process enums and their references
        let enums: Record<string, any> = {};
        let enumReferences: Record<string, any> = {};
        columnsRes.rows.forEach(({ table_name, data_type, udt_name }) => {
            if (data_type === "USER-DEFINED") {
                if (!enums[udt_name]) {
                    enums[udt_name] = [];
                    enumReferences[udt_name] = new Set();
                }
                enumReferences[udt_name].add(table_name);
            }
        });

        enumsRes.rows.forEach(({ enum_name, enum_value }) => {
            enums[enum_name].push(enum_value);
        });

        let schemaString = "";

        // Sort and add enums with comments
        const sortedEnums = Object.keys(enums).sort();
        sortedEnums.forEach((enumName) => {
            const references = Array.from(enumReferences[enumName]);
            let comment = insertSpan(
                "comment",
                `-- Referenced in ${references.join(", ")}.`,
                fileType,
            );

            while (comment.length > 80) {
                comment = comment.replace(/, [^,]*$/, ",\n--$&");
            }

            let tableType = insertSpan("tableType", "enum", fileType);

            let formattedEnumName = insertSpan("tableName", enumName, fileType);

            schemaString += `${comment}\n${tableType} ${formattedEnumName} ${openCurlyBracket}\n`;
            enums[enumName].forEach((value: any) => {
                schemaString += `  ${insertSpan(
                    "columnName",
                    value,
                    fileType,
                )}\n`;
            });
            schemaString += `${closeCurlyBracket}\n\n`;
        });

        // Process columns with default values
        let schema: Record<string, any> = {};
        columnsRes.rows.forEach(
            ({
                table_name,
                column_name,
                data_type,
                udt_name,
                column_default,
                is_nullable,
            }) => {
                if (!schema[table_name]) {
                    schema[table_name] = [];
                }

                const type =
                    data_type === "USER-DEFINED" ? udt_name : data_type;

                schema[table_name].push({
                    column_name,
                    type,
                    column_default,
                    is_nullable,
                });
            },
        );

        // Determine the longest column name and type for formatting
        let longestColumnName = 0;
        let longestColumnType = 0;
        let longestColumnDefault = 0;
        for (const table of Object.values(schema)) {
            table.forEach(
                ({
                    column_name,
                    type,
                    column_default,
                    is_nullable,
                }: {
                    column_name: string;
                    type: string;
                    column_default: string | null;
                    is_nullable: string;
                }) => {
                    const nullable = is_nullable === "YES";
                    const columnNameLength = nullable
                        ? column_name.length + 1
                        : column_name.length;

                    if (columnNameLength > longestColumnName)
                        longestColumnName = columnNameLength;
                    if (type.length > longestColumnType)
                        longestColumnType = type.length;
                    if (
                        column_default &&
                        column_default.length > longestColumnDefault
                    )
                        longestColumnDefault =
                            column_default.length + "DEFAULT".length;
                },
            );
        }

        // Sort and add tables with formatted columns
        const sortedTables = Object.keys(schema).sort();
        sortedTables.forEach((table) => {
            const columns = schema[table];

            let tableType = insertSpan("tableType", "model", fileType);
            let tableName = insertSpan("tableName", table, fileType);

            schemaString += `${tableType} ${tableName} ${openCurlyBracket}\n`;
            columns.forEach(
                ({
                    column_name,
                    type,
                    column_default,
                    is_nullable,
                }: {
                    column_name: string;
                    type: string;
                    column_default: string;
                    is_nullable: string;
                }) => {
                    const nullable = is_nullable === "YES";

                    const formattedColumnNullable = nullable
                        ? insertSpan(
                              "columnProperty",
                              "?",
                              fileType,
                              "This column is nullable.",
                          )
                        : "";

                    let formattedColumnName = insertSpan(
                        "columnName",
                        `${column_name}${nullable ? "?" : ""}`.padEnd(
                            longestColumnName + COLUMN_PADDING,
                            " ",
                        ),
                        fileType,
                    );

                    formattedColumnName = formattedColumnName.replace(
                        "?",
                        formattedColumnNullable,
                    );

                    const formattedColumnType = insertSpan(
                        "columnType",
                        type.padEnd(longestColumnType + COLUMN_PADDING, " "),
                        fileType,
                    );

                    let columnLine = `${formattedColumnName}${formattedColumnType}`;

                    if (column_default) {
                        const columnDefault = insertSpan(
                            "columnProperty",
                            "DEFAULT",
                            fileType,
                        );

                        const columnDefaultValue = insertSpan(
                            "text",
                            column_default,
                            fileType,
                        );

                        columnLine += ` ${columnDefault} ${columnDefaultValue}`;
                    } else {
                        columnLine += " ".repeat(
                            longestColumnDefault + "DEFAULT".length,
                        );
                    }

                    schemaString += `  ${columnLine}\n`;
                },
            );
            schemaString += `${closeCurlyBracket}\n\n`;
        });

        const commentDateGenerated = insertSpan(
            "comment",
            `-- This file was generated on ${getFormattedDateTimeString(
                new Date(),
            )}.`,
            fileType,
        );

        let htmlHeader = "";
        htmlHeader += `<!-- ${commentDateGenerated}. -->\n`;
        htmlHeader += `<!-- This file is best viewed in a browser -->\n\n`;
        htmlHeader += `<!DOCTYPE html>\n<html data-theme="light">\n<head>\n\t`;
        htmlHeader += getHTMLStyles();
        htmlHeader += getScript();
        htmlHeader += '\n</head>\n<body><pre class="pre">\n\n';
        htmlHeader += `${commentDateGenerated}\n\n`;

        const txtHeader = commentDateGenerated + "\n\n";

        let htmlFooter = "";
        htmlFooter += `
        <button
            type="button"
            data-theme-toggle
            aria-label="Change color theme"
            style="position: absolute; top: 16px; right: 16px; border-style: none; border-radius: 2px; background-color: var(--color-comment); color: var(--color-backgroundColor); padding: 8px; padding-left: 16px; padding-right: 16px; cursor: pointer;"
        >Toggle theme</button>`;
        htmlFooter += "</pre></body></html>";

        const htmlString = htmlHeader + schemaString + htmlFooter;

        const txtString = txtHeader + schemaString;

        fs.writeFileSync(
            `${filename}.${fileType}`,
            fileType === "html" ? htmlString : txtString,
        );
    } finally {
        client.release();
        await pool.end();
    }
    return;
}

main();
