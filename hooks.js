import * as duckdb from "@duckdb/duckdb-wasm";

const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

export const usePokemonList = () => {
  const { createTable, dropTable, selectAll } = useDuckdbWasm();
  const fetchData = async () => {
    const exists = await selectAll("pokemon");
    if (exists.data) {
      return exists;
    }
    const res = await fetch("https://pokeapi.co/api/v2/pokemon");
    if (!res.ok) {
      return {
        error: `Failed to fetch data: ${res.status} ${res.statusText}`,
      };
    }
    const buffer = await res.arrayBuffer();
    await createTable("pokemon", buffer);

    return await selectAll("pokemon");
  };

  return {
    fetchData,
    remove: () => dropTable("pokemon"),
  };
};

export const useDuckdbWasm = () => {
  /**
   * @param {string} tableName
   * @param {ArrayBuffer} buffer
   */
  const createTable = async (tableName, buffer) => {
    console.log(`Creating or recreating table ${tableName}`);
    return await withDuckDb(async (db) => {
      const c = await db.connect();
      try {
        await db.registerFileBuffer(
          `${tableName}.json`,
          new Uint8Array(buffer)
        );
        console.log(`Registered file ${tableName}.json`);
        await c.query(`DROP TABLE IF EXISTS ${tableName}`);
        console.log(`Dropped table ${tableName} if it existed`);
        await c.query(
          `CREATE TABLE ${tableName} AS SELECT * FROM read_json_auto('${tableName}.json')`
        );
        await c.send("CHECKPOINT;");
        console.log(`Table ${tableName} created or recreated successfully`);
      } catch (error) {
        console.error(`Error creating table ${tableName}:`, error);
      } finally {
        await db.dropFile(`${tableName}.json`);
        console.log("closeing connection");
        await c.close();
      }
    });
  };

  const selectAll = async (tableName) => {
    console.log(`Selecting all from table ${tableName}`);
    return withDuckDb(async (db) => {
      const c = await db.connect();

      try {
        // table 存在チェック
        const tableExists = await c.query(`
        SELECT EXISTS (
          SELECT 1 
          FROM information_schema.tables 
          WHERE table_name = '${tableName}'
        ) as exists_flag;
      `);
        if (tableExists.toArray()[0].exists_flag === false) {
          console.warn(`Table ${tableName} does not exist.`);
          return { error: `Table ${tableName} does not exist.` };
        }

        const result = await c.query(`SELECT * FROM ${tableName}`);
        return { data: result.toArray().map((r) => JSON.parse(r)) };
      } catch (error) {
        return { error };
      } finally {
        console.log("closeing connection");
        await c.close();
      }
    });
  };

  const dropTable = async (tableName) => {
    console.log(`Dropping table ${tableName}`);
    return withDuckDb(async (db) => {
      const c = await db.connect();
      try {
        await c.query(`DROP TABLE IF EXISTS ${tableName}`);
        console.log(`Table ${tableName} dropped successfully`);
      } catch (error) {
        console.error(`Error dropping table ${tableName}:`, error);
      } finally {
        console.log("closeing connection");
        await c.close();
      }
    });
  };

  return { createTable, dropTable, selectAll };
};

const logger = new duckdb.ConsoleLogger();

/**
 * @template T
 * @param {(db: duckdb.AsyncDuckDB) => Promise<T>} fn
 * @return {Promise<T>}
 */
const withDuckDb = async (fn) => {
  return await navigator.locks.request(
    "practice-duckdb-wasm-lock",
    async () => {
      console.log("Acquired DuckDB-Wasm lock");
      const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
      console.log("Initialized DuckDB-Wasm bundle");
      const workerUrl = URL.createObjectURL(
        new Blob([`importScripts("${bundle.mainWorker}");`], {
          type: "text/javascript",
        })
      );
      const worker = new Worker(workerUrl);
      console.log("Initialized DuckDB-Wasm worker");
      const db = new duckdb.AsyncDuckDB(logger, worker);
      try {
        await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
        console.log("DuckDB-Wasm instantiated");
        await db.open({
          path: "opfs://duckdb-wasm.db",
          accessMode: duckdb.DuckDBAccessMode.READ_WRITE,
        });
        console.log("DuckDB-Wasm database opened");

        //HACK https://github.com/duckdb/duckdb-wasm/pull/1962#issuecomment-2918724468
        const c = await db.connect();
        await c.query("CREATE OR REPLACE TABLE init_tmp as select 1;");
        await c.query("DROP TABLE init_tmp;");
        await c.close();

        console.log("DuckDB-Wasm initialized successfully");
        return await fn(db);
      } finally {
        await db.terminate();
        URL.revokeObjectURL(workerUrl);
        console.log("Releasing DuckDB-Wasm lock");
      }
    }
  );
};
