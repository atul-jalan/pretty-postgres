#!/usr/bin/env node
import pg from "pg";
import fs from "fs";

import {
    getFormattedDateTimeString,
    getHTMLStyles,
    getScript,
    splitString,
    toggleThemeButton,
    wrapElement,
    wrapSpan,
} from "./utils.js";
import { type ColumnQueryResult, columnsQuery, enumsQuery } from "./queries.js";

type FileType = "txt" | "html";

const TAB_LENGTH = 2;
const COLUMN_PADDING = 2;
const COMMENT_MAX_PRINT_WIDTH = 80;
const DEFAULT_FILE_TYPE: FileType = "html";
const DEFAULT_FILE_NAME = "pretty-postgres-schema";

const ENUM_DATA_TYPE = "USER-DEFINED";

const GENERATE_COMMAND_OPTIONS = {
    CONNECTION_STRING: ["-connection-string", "-cs"],
    FILENAME: ["-filename", "-fn"],
    FILETYPE: ["-filetype", "-ft"],
};

const MODEL_TYPE_NAMES = {
    TABLE: "table",
    ENUM: "enum",
};

const FILETYPES = {
    HTML: "html",
    TXT: "txt",
} as const;

const TAB = " ".repeat(TAB_LENGTH);

const FORMATTED_CURRENT_DATE = getFormattedDateTimeString(new Date());
const CREATED_ON_COMMENT = `This file was generated on ${FORMATTED_CURRENT_DATE}.`;

function main(): void {
    const command = process.argv[2];

    if (command !== "generate") {
        console.error("Error: command not recognized.\n");
        return;
    }

    const additionalArgs = process.argv.slice(3);

    let connectionString: string | null = null;
    let filename: string | null = null;
    let filetype: FileType | null = null;

    for (let i = 0; i < additionalArgs.length; i += 1) {
        const arg = additionalArgs[i];

        if (i === additionalArgs.length - 1) {
            continue;
        }

        if (GENERATE_COMMAND_OPTIONS.CONNECTION_STRING.includes(arg)) {
            connectionString = additionalArgs[i + 1];
            i += 1;
        } else if (GENERATE_COMMAND_OPTIONS.FILENAME.includes(arg)) {
            filename = additionalArgs[i + 1];
            i += 1;
        } else if (GENERATE_COMMAND_OPTIONS.FILETYPE.includes(arg)) {
            const inputtedFileType = additionalArgs[i + 1];
            if (
                inputtedFileType === FILETYPES.HTML ||
                inputtedFileType === FILETYPES.TXT
            ) {
                filetype = inputtedFileType;
            } else {
                console.error(
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
        console.error(
            "Error: you must provide a connection string with the -connection-string or -cs flag.",
        );
        return;
    }

    if (filename === null) {
        console.log(
            `Writing schema to ${selectedFileName}.${selectedFileType}.`,
        );
        console.log(
            `You can optionally specify a filename with the ${GENERATE_COMMAND_OPTIONS.FILENAME[0]} or ${GENERATE_COMMAND_OPTIONS.FILENAME[1]} flag.`,
        );
    }

    generate(connectionString, selectedFileName, selectedFileType);
}

async function generate(
    connectionString: string,
    filename: string,
    fileType: "txt" | "html",
): Promise<void> {
    function wrapSpanIfHTML(
        content: Parameters<typeof wrapSpan>[0],
        className: Parameters<typeof wrapSpan>[1],
        tooltip?: Parameters<typeof wrapSpan>[2],
    ) {
        if (fileType === "html") {
            return wrapSpan(content, className, tooltip);
        }
        return content;
    }

    function formatComment(text: string) {
        return splitString(text, COMMENT_MAX_PRINT_WIDTH)
            .map((line) => wrapSpanIfHTML(line, "comment"))
            .join("\n");
    }

    const openCurlyBracket = wrapSpanIfHTML("{", "punctuation");
    const closeCurlyBracket = wrapSpanIfHTML("}", "punctuation");
    const openParens = wrapSpanIfHTML("(", "punctuation");
    const closeParens = wrapSpanIfHTML(")", "punctuation");

    const pool = new pg.Pool({
        connectionString: connectionString,
    });

    const client = await pool.connect();

    try {
        const columns = (await columnsQuery(client)).rows;
        const enums = (await enumsQuery(client)).rows;

        const enumsByName: Record<string, string[]> = {};
        enums.forEach(({ enum_name, enum_values }) => {
            enumsByName[enum_name] = enum_values;
        });

        let enumTableReferences: Record<string, Set<string>> = {};
        columns.forEach(({ table_name, data_type, udt_name }) => {
            if (data_type === ENUM_DATA_TYPE) {
                if (!enumTableReferences[udt_name]) {
                    enumTableReferences[udt_name] = new Set();
                }
                enumTableReferences[udt_name].add(table_name);
            }
        });

        let schemaString = "";

        // Sort and add enums with comments
        const sortedEnumNames = Object.keys(enumsByName).sort();
        sortedEnumNames.forEach((enumName) => {
            const references = Array.from(enumTableReferences[enumName]);
            const formattedComment = formatComment(
                `-- Referenced in ${references.join(", ")}.`,
            );

            let tableType = wrapSpanIfHTML(MODEL_TYPE_NAMES.ENUM, "tableType");
            let formattedEnumName = wrapSpanIfHTML(enumName, "tableName");

            schemaString += `${formattedComment}\n${tableType} ${formattedEnumName} ${openCurlyBracket}\n`;
            enumsByName[enumName].forEach((value: any) => {
                schemaString += `${TAB}${wrapSpanIfHTML(
                    value,
                    "columnName",
                )}\n`;
            });
            schemaString += `${closeCurlyBracket}\n\n`;
        });

        // Process columns with default values
        let schema: Record<
            string,
            Array<
                ColumnQueryResult & {
                    type:
                        | ColumnQueryResult["udt_name"]
                        | ColumnQueryResult["data_type"];
                }
            >
        > = {};
        columns
            .sort((a, b) => {
                if (a.is_nullable === "YES" && b.is_nullable === "NO") {
                    return 1;
                } else if (b.is_nullable === "YES" && a.is_nullable === "NO") {
                    return -1;
                }
                return 0;
            })
            .forEach((column) => {
                if (!schema[column.table_name]) {
                    schema[column.table_name] = [];
                }

                const type =
                    column.data_type === ENUM_DATA_TYPE
                        ? column.udt_name
                        : column.data_type;

                schema[column.table_name].push({
                    ...column,
                    type,
                });
            });

        // Determine the longest column name and type for formatting
        let longestColumnName = 0;
        let longestColumnType = 0;
        let longestColumnDefault = 0;
        for (const table of Object.values(schema)) {
            table.forEach(
                ({ column_name, type, column_default, is_nullable }) => {
                    // If the column is nullable, add 1 to the length for the
                    // question mark.
                    const nullable = is_nullable === "YES";
                    const columnNameLength = nullable
                        ? column_name.length + 1
                        : column_name.length;

                    if (columnNameLength > longestColumnName) {
                        longestColumnName = columnNameLength;
                    }
                    if (type.length > longestColumnType) {
                        longestColumnType = type.length;
                    }
                    if (
                        column_default &&
                        column_default.length > longestColumnDefault
                    ) {
                        longestColumnDefault =
                            column_default.length + "DEFAULT".length;
                    }
                },
            );
        }

        // Sort and add tables with formatted columns
        const sortedTables = Object.keys(schema).sort();
        sortedTables.forEach((table) => {
            const columns = schema[table];

            let tableType = wrapSpanIfHTML(MODEL_TYPE_NAMES.TABLE, "tableType");
            let tableName = wrapSpanIfHTML(table, "tableName");

            schemaString += `${tableType} ${tableName} ${openCurlyBracket}\n`;
            columns.forEach(
                ({
                    column_name,
                    type,
                    column_default,
                    is_nullable,
                    foreign_key_table,
                    foreign_key_column,
                    foreign_key_delete_rule,
                    foreign_key_update_rule,
                }) => {
                    const nullable = is_nullable === "YES";

                    const formattedColumnNullable = nullable
                        ? wrapSpanIfHTML(
                              "?",
                              "columnProperty bold",
                              `${column_name} is NULLABLE.`,
                          )
                        : "";

                    let formattedColumnName = wrapSpanIfHTML(
                        `${column_name}${nullable ? "?" : ""}`.padEnd(
                            longestColumnName + COLUMN_PADDING,
                            " ",
                        ),
                        "columnName",
                    );

                    formattedColumnName = formattedColumnName.replace(
                        "?",
                        formattedColumnNullable,
                    );

                    const formattedColumnType = wrapSpanIfHTML(
                        type.padEnd(longestColumnType + COLUMN_PADDING, " "),
                        "columnType",
                    );

                    let columnLine = `${formattedColumnName}${formattedColumnType}`;

                    if (column_default) {
                        const columnDefault = wrapSpanIfHTML(
                            "DEFAULT",
                            "columnProperty",
                        );

                        const columnDefaultValue = wrapSpanIfHTML(
                            column_default,
                            "text",
                        );

                        columnLine += `${columnDefault} ${columnDefaultValue} `;
                    }
                    if (foreign_key_table && foreign_key_column) {
                        const columnReference = wrapSpanIfHTML(
                            "REFERENCES",
                            "columnProperty",
                        );
                        const foreignKeyTable = wrapSpanIfHTML(
                            foreign_key_table,
                            "tableName",
                        );
                        const foreignIdColumn = wrapSpanIfHTML(
                            foreign_key_column,
                            "text",
                        );

                        columnLine += `${columnReference} ${foreignKeyTable}${openParens}${foreignIdColumn}${closeParens} `;
                    }
                    if (
                        foreign_key_delete_rule &&
                        foreign_key_delete_rule !== "NO ACTION"
                    ) {
                        const columnDelete = wrapSpanIfHTML(
                            "ON DELETE",
                            "columnProperty",
                        );

                        const columnDeleteValue = wrapSpanIfHTML(
                            foreign_key_delete_rule,
                            "text",
                        );

                        columnLine += `${columnDelete} ${columnDeleteValue} `;
                    }
                    if (
                        foreign_key_update_rule &&
                        foreign_key_update_rule !== "NO ACTION"
                    ) {
                        const columnUpdate = wrapSpanIfHTML(
                            "ON UPDATE",
                            "columnProperty",
                        );

                        const columnUpdateValue = wrapSpanIfHTML(
                            foreign_key_update_rule,
                            "text",
                        );

                        columnLine += `${columnUpdate} ${columnUpdateValue} `;
                    }

                    schemaString += `${TAB}${columnLine}\n`;
                },
            );
            schemaString += `${closeCurlyBracket}\n\n`;
        });

        const formattedCreatedOnComment = wrapSpanIfHTML(
            `-- ${CREATED_ON_COMMENT}`,
            "comment",
        );

        const prettyPostgresLink = wrapElement("pretty-postgres", "a", {
            href: "https://github.com/atul-jalan/pretty-postgres",
            class: "link",
            target: "_blank",
        });

        const formattedAttributionComment = wrapSpanIfHTML(
            `-- Made with ${prettyPostgresLink}.`,
            "comment",
        );

        const htmlPre = wrapElement(
            `${formattedCreatedOnComment}\n${formattedAttributionComment}\n\n` +
                schemaString +
                toggleThemeButton,
            "pre",
            { class: "pre" },
        );

        const htmlHead = wrapElement(getHTMLStyles() + getScript(), "head");
        const htmlBody = wrapElement(htmlPre, "body");

        const htmlContent = wrapElement(htmlHead + htmlBody, "html", {
            "data-theme": "light",
        });

        const htmlHeader = `<!-- This file is best viewed in a browser! -->\n<!-- ${CREATED_ON_COMMENT} -->\n<!-- Made with pretty-postgres: https://github.com/atul-jalan/pretty-postgres -->\n\n<!DOCTYPE html>\n`;
        const htmlString = htmlHeader + htmlContent;

        const txtString =
            formattedCreatedOnComment +
            "\n" +
            "-- Made with pretty-postgres: https://github.com/atul-jalan/pretty-postgres" +
            "\n\n" +
            "-- Note: A '?' after a column name indicates that the column is nullable." +
            "\n\n" +
            schemaString;

        fs.writeFileSync(
            `${filename}.${fileType}`,
            fileType === "html" ? htmlString : txtString,
        );
    } finally {
        client.release();
        await pool.end();
        console.log("\nDone!");
        if (fileType === "html") {
            console.log(
                "Open the generated file in a browser to view the schema with the following terminal command:",
            );
            console.log("open " + filename + ".html");
        }
    }
    return;
}

main();
