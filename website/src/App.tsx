import { BrowserRouter, Routes, Route } from 'react-router-dom';
import NavBar from './components/NavBar';
import Home from './pages/Home';
import Concepts from './pages/Concepts';
import Simulator from './pages/Simulator';
import P4Code from './pages/P4Code';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background text-foreground">
        <NavBar />
        <main className="mx-auto max-w-7xl px-4 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/concepts" element={<Concepts />} />
            <Route path="/simulator" element={<Simulator />} />
            <Route path="/p4" element={<P4Code />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
