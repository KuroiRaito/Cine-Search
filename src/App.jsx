import { useState } from 'react';
import UsernameEntry from './components/UsernameEntry';
import HomeView from './views/HomeView';
import ProfileView from './views/ProfileView';
import { useSavedMovies } from './hooks/useSavedMovies';
import { getDetails, getTVFullDetails } from './lib/tmdb';
import DetailModal from './components/DetailModal';
import Footer from './components/Footer';
import './App.css';

export default function App() {
  const [userId, setUserId] = useState(localStorage.getItem('user_id'));
  const [username, setUsername] = useState(localStorage.getItem('username'));
  const [view, setView] = useState('home'); // 'home' or 'profile'
  const [selectedMovieData, setSelectedMovieData] = useState(null);

  const { savedMovies, handleSaveMovie, wishlistDetails, fetchWishlistDetails } = useSavedMovies(userId);

  async function handleCardClick(movie) {
    try {
      const type = movie.media_type === 'tv' || (!movie.media_type && movie.first_air_date) ? 'tv' : 'movie';
      if (type === 'tv') {
        const tmdb = await getTVFullDetails(movie.id);
        setSelectedMovieData({ tmdb });
      } else {
        const tmdb = await getDetails(movie.id, type);
        setSelectedMovieData({ tmdb });
      }
    } catch (e) {
      console.error(e);
    }
  }

  function handleLogout() {
    localStorage.removeItem('user_id');
    localStorage.removeItem('username');
    window.location.reload();
  }

  if (!userId) {
    return <UsernameEntry onReady={() => {
      setUserId(localStorage.getItem('user_id'));
      setUsername(localStorage.getItem('username'));
    }} />;
  }

  return (
    <div className="app-container">
      {/* Top Bar with Navigation */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 20px',
        backgroundColor: '#1e293b',
        color: '#94a3b8',
        fontSize: '0.9rem',
        borderBottom: '1px solid #334155',
        marginBottom: '1rem'
      }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <button onClick={() => setView('home')} style={{ background: 'transparent', border: 'none', color: view === 'home' ? '#fff' : '#94a3b8', fontWeight: view === 'home' ? 'bold' : 'normal', cursor: 'pointer', fontSize: '1rem' }}>Home</button>
          <button onClick={() => setView('profile')} style={{ background: 'transparent', border: 'none', color: view === 'profile' ? '#fff' : '#94a3b8', fontWeight: view === 'profile' ? 'bold' : 'normal', cursor: 'pointer', fontSize: '1rem' }}>Profile</button>
        </div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <span>Logged in as: <strong style={{ color: '#fff' }}>{username}</strong></span>
          <button onClick={handleLogout} style={{ padding: '4px 12px', backgroundColor: 'transparent', border: '1px solid #475569', color: '#cbd5e1', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>Logout</button>
        </div>
      </div>

      {view === 'home' ? (
        <HomeView savedMovies={savedMovies} handleSaveMovie={handleSaveMovie} onCardClick={handleCardClick} />
      ) : (
        <ProfileView
          username={username}
          savedMovies={savedMovies}
          handleSaveMovie={handleSaveMovie}
          wishlistDetails={wishlistDetails}
          fetchWishlistDetails={fetchWishlistDetails}
          onCardClick={handleCardClick}
        />
      )}

      {selectedMovieData && (
        <DetailModal data={selectedMovieData} onClose={() => setSelectedMovieData(null)} />
      )}

      <Footer />
    </div>
  );
}
