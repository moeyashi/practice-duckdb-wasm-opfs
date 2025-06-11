import { createRoot } from "react-dom/client";
import { useState } from "react";
import { usePokemonList } from "./hooks";

function App() {
  const { fetchData, remove } = usePokemonList();

  const [message, setMessage] = useState('select を押してね');

  const handleSelectAll = async () => {
    try {
      setMessage('loading...');
      const result = await fetchData();
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
      <div><button onClick={handleSelectAll}>select</button></div>
      <div><button onClick={remove}>remove</button></div>
      <div>{message}</div>
    </div>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);
