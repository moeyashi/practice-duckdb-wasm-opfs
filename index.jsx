import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { useDuckdbWasm } from "./hooks";

function App() {
  const { createTable, selectAll } = useDuckdbWasm();
  // const { pokemonList, loading, error } = usePokemonList();

  const [message, setMessage] = useState('select を押してね');

  const handleCreateTable = async () => {
    try {
      await createTable("pokemon", [
        { id: 1, name: "Pikachu" },
        { id: 2, name: "Bulbasaur" },
        { id: 3, name: "Charmander" }
      ]);
    } catch (error) {
      setMessage(`Error creating table: ${error}`);
    }
  }

  const handleSelectAll = async () => {
    try {
      const result = await selectAll("pokemon");
      if (result.error) {
        setMessage(`Error selecting from table: ${result.error}`);
      } else {
        console.table(result.data);
        setMessage(`${JSON.stringify(result.data)}`);
      }
    } catch (error) {
      setMessage(`Error selecting from table: ${error}`);
    }
  }

  return (
    <div>
      <h1>ポケモンリスト</h1>
      <div><button onClick={handleCreateTable}>create</button></div>
      <div><button onClick={handleSelectAll}>select</button></div>
      <div>{message}</div>
      {/* {loading && <p>読み込み中...</p>}
      {error && <p style={{ color: 'red' }}>エラー: {error}</p>}
      <ul>
        {pokemonList.map((pokemon) => (
          <li key={pokemon.name}>{pokemon.name}</li>
        ))}
      </ul> */}
    </div>
  );
}

const usePokemonList = () => {
  const [pokemonList, setPokemonList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fn = async () => {
      try {
        const exists = await getResponseFromCache();
        if (exists) {
          console.log("OPFSからキャッシュを読み込みました");
          const jsonData = await decompressGzip(exists);
          setPokemonList(jsonData.results);
          setLoading(false);
          return;
        }
        const res = await fetch("https://pokeapi.co/api/v2/pokemon")
        if (!res.ok) {
          throw new Error("APIリクエストに失敗しました");
        }
        const gzipData = await saveResponseToCache(res);
        const data = await decompressGzip(gzipData);
        setPokemonList(data.results);
        setLoading(false);
      } catch (err) {
        console.error(err)
        setError(err.message);
        setLoading(false);
      }
    }
    fn();
  }, []);

  return { pokemonList, loading, error };
}

const fileName = "pokemon-list.json.gz";

/**
 * @param {Response} response 
 * @returns 
 */
const saveResponseToCache = async (response) => {
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  // レスポンスをArrayBufferとして取得
  const buf = await response.arrayBuffer();
  console.log(`Fetched ${buf.byteLength} bytes of buffer data`);
  const gzipData = await compressToGzip(buf);
  console.log(`Compressed to ${gzipData.byteLength} bytes of gzip data`);

  // OPFSのルートディレクトリを取得
  const opfsRoot = await navigator.storage.getDirectory();

  // ファイルハンドルを作成
  const fileHandle = await opfsRoot.getFileHandle(fileName, { 
    create: true 
  });

  // 書き込み可能なストリームを取得
  const writable = await fileHandle.createWritable();

  // gzipデータをそのまま書き込み
  await writable.write(gzipData);
  await writable.close();

  console.log(`Successfully saved ${fileName} to OPFS`);
  return gzipData;
}

const getResponseFromCache = async () => {
  try {
    const opfsRoot = await navigator.storage.getDirectory();
    const fileHandle = await opfsRoot.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    const arrayBuffer = await file.arrayBuffer();
    console.log(`Read ${arrayBuffer.byteLength} bytes from OPFS`);
    return arrayBuffer;
  } catch (error) {
    console.error(`Error reading from OPFS: ${error.message}`);
    return null;
  }
}

/**
 * ArrayBufferをgzip圧縮する関数
 * @param {ArrayBuffer} buf
 * @returns {Promise<Uint8Array>}
 */
const compressToGzip = async (buf) => {
  // CompressionStreamを使用してgzip圧縮
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(buf);
      controller.close();
    }
  });

  const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
  const reader = compressedStream.getReader();
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  // チャンクを結合してUint8Arrayを作成
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
};

/**
 * @param {ArrayBuffer} gzipData 
 * @returns 
 */
const decompressGzip = async (gzipData) => {
  console.log(new TextDecoder().decode(gzipData))

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(gzipData));
      controller.close();
    }
  });

  const decompressedStream = stream.pipeThrough(
    new DecompressionStream('gzip')
  );

  const reader = decompressedStream.getReader();
  const chunks = [];
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  // チャンクを結合
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return JSON.parse(new TextDecoder().decode(result))
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);
