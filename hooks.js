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
    await db.registerFileText("rows.json", JSON.stringify(json));
    await c.query(`DROP TABLE IF EXISTS ${tableName}`);
    await c.insertJSONFromPath("rows.json", { name: tableName });
    // await db.dropFile("rows.json");
    const result = await c.query(`SELECT * FROM ${tableName} LIMIT 10`);
    console.table(result.toArray());
    await c.close();
  };

  return { initialized, createTable };
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
    await db.open({
      path: "opfs://duckdb-wasm.db",
      accessMode: duckdb.DuckDBAccessMode.READ_WRITE,
    });
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
