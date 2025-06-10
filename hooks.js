import * as duckdb from "@duckdb/duckdb-wasm";
import { useEffect, useState } from "react";

const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

let initializing = false;

/**
 * @type {duckdb.AsyncDuckDB|null}
 */
let _db = null;

export const useDuckdbWasm = () => {
  /**
   * @type {[duckdb.AsyncDuckDB|null, Function]}
   */
  const [db, setDb] = useState(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const fn = async () => {
      const db = await init();
      if (!db) {
        console.error("Failed to initialize DuckDB-Wasm");
        setInitialized(true);
        return;
      }
      console.log("DuckDB-Wasm is ready to use");
      setDb(db);
      setInitialized(true);
    };
    fn();
  }, []);

  /**
   * @param {string} tableName
   * @param {Array<Record>} json
   */
  const createTable = async (tableName, json) => {
    if (db === null) {
      throw new Error("DuckDB-Wasm is not initialized");
    }
    console.log(`Creating or recreating table ${tableName}`);
    /** @type {duckdb.AsyncDuckDBConnection} */
    const c = await db.connect();
    try {
      await db.registerFileText(`${tableName}.json`, JSON.stringify(json));
      console.log(`Registered file ${tableName}.json`);
      await c.query(`DROP TABLE IF EXISTS ${tableName}`);
      await c.query(
        `CREATE TABLE ${tableName} AS SELECT * FROM read_json_auto('${tableName}.json')`
      );
      console.log(`Table ${tableName} created or recreated successfully`);
    } catch (error) {
      console.error(`Error creating table ${tableName}:`, error);
    } finally {
      await db.dropFile(`${tableName}.json`);
      await c.close();
    }
  };

  const selectAll = async (tableName) => {
    if (db === null) {
      return { error: "DuckDB-Wasm is not initialized" };
    }
    console.log(`Selecting all from table ${tableName}`);
    /** @type {duckdb.AsyncDuckDBConnection} */
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
        return { error: `Table ${tableName} does not exist.` };
      }

      const result = await c.query(`SELECT * FROM ${tableName}`);
      return { data: result.toArray().map((r) => JSON.parse(r)) };
    } catch (error) {
      return { error };
    } finally {
      await c.close();
    }
  };

  return { initialized, createTable, selectAll };
};

/**
 * @returns {Promise<duckdb.AsyncDuckDB|null>}
 */
const init = async () => {
  if (_db) {
    console.log("DuckDB-Wasm is already initialized");
    return _db;
  }
  if (initializing) {
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve(init());
      }, 1000);
    });
    return init();
  }
  console.log("Initializing DuckDB-Wasm...");
  initializing = true;
  try {
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
    const workerUrl = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker}");`], {
        type: "text/javascript",
      })
    );
    const worker = new Worker(workerUrl);
    const logger = new duckdb.ConsoleLogger();
    const db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    console.log("DuckDB-Wasm instantiated");
    await db.open({
      path: "opfs://duckdb-wasm.db",
      accessMode: duckdb.DuckDBAccessMode.READ_WRITE,
    });
    console.log("DuckDB-Wasm database opened");
    URL.revokeObjectURL(workerUrl);
    console.log("DuckDB-Wasm initialized successfully");
    _db = db;
    return _db;
  } catch (error) {
    console.error("Error initializing DuckDB-Wasm:", error);
    return null;
  } finally {
    initializing = false;
  }
};
