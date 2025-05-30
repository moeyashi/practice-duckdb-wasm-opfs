import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";

function App() {
  const { pokemonList, loading, error } = usePokemonList();

  return (
    <div>
      <h1>ポケモンリスト</h1>
      {loading && <p>読み込み中...</p>}
      {error && <p style={{ color: 'red' }}>エラー: {error}</p>}
      <ul>
        {pokemonList.map((pokemon) => (
          <li key={pokemon.name}>{pokemon.name}</li>
        ))}
      </ul>
    </div>
  );
}

// ポケモンリストを取得するカスタムフック
function usePokemonList() {
  const [pokemonList, setPokemonList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("https://pokeapi.co/api/v2/pokemon")
      .then((res) => {
        if (!res.ok) throw new Error("APIリクエストに失敗しました");
        return res.json();
      })
      .then((data) => {
        setPokemonList(data.results || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return { pokemonList, loading, error };
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);
