import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
function getConnectionString(): string {
    if (process.env.DATABASE_URL)
        return process.env.DATABASE_URL;
    const user = process.env.POSTGRES_USER;
    const password = process.env.POSTGRES_PASSWORD;
    const host = process.env.POSTGRES_HOST;
    const port = process.env.POSTGRES_PORT;
    const db = process.env.POSTGRES_DB;
    if (!user || !password)
        throw new Error('Database not configured: set DATABASE_URL or POSTGRES_USER and POSTGRES_PASSWORD');
    return `postgresql://${user}:${password}@${host}:${port}/${db}`;
}
let pool: Pool | null = null;
function getPool(): Pool {
    if (!pool)
        pool = new Pool({ connectionString: getConnectionString() });
    return pool;
}
export const query = async <T extends QueryResultRow = QueryResultRow>(text: string, params?: any[]): Promise<QueryResult<T>> => {
    return getPool().query<T>(text, params);
};
export const getClient = async (): Promise<PoolClient> => {
    return getPool().connect();
};
export const closePool = async (): Promise<void> => {
    if (pool) {
        await pool.end();
        pool = null;
    }
};
