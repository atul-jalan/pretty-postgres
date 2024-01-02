import pg from "pg";

import { type Nullable } from "./types";

interface ColumnQueryResult {
    table_name: string;
    column_name: string;
    data_type: string | "USER-DEFINED";
    udt_name: string;
    column_default: Nullable<string>;
    is_nullable: "YES" | "NO";
    constraint_type: Nullable<string>;
    foreign_key_table: Nullable<string>;
    foreign_key_column: Nullable<string>;
    foreign_key_delete_rule: Nullable<string>;
    foreign_key_update_rule: Nullable<string>;
}

async function columnsQuery(client: pg.PoolClient) {
    return await client.query<ColumnQueryResult>(`
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
}

interface EnumQueryResult {
    enum_name: string;
    enum_values: string[];
}

async function enumsQuery(client: pg.PoolClient) {
    return await client.query<EnumQueryResult>(`
    SELECT 
        t.typname AS enum_name,
        jsonb_agg(e.enumlabel) AS enum_values
    FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid  
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    GROUP BY t.typname
    `);
}

export { columnsQuery, enumsQuery };
