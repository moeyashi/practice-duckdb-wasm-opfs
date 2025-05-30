import { createRoot } from "react-dom/client";

function App() {
  return (
    <div>
      <h1>Hello Vite</h1>
    </div>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);
