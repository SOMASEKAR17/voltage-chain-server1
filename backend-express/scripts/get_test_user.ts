import { query, closePool } from '../src/config/postgres';

async function main() {
    try {
        const res = await query('SELECT id FROM public.users LIMIT 1');
        if (res.rows.length > 0) {
            console.log(res.rows[0].id);
        } else {
            console.error("No users found");
            process.exit(1);
        }
    } catch (e) {
        console.error(e);
        process.exit(1);
    } finally {
        await closePool();
    }
}
main();
