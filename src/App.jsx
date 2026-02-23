import { useState } from 'react';
import UsernameEntry from './components/UsernameEntry';
import HomeView from './views/HomeView';
import ProfileView from './views/ProfileView';
import { useSavedMovies } from './hooks/useSavedMovies';
import { getDetails, getTVFullDetails } from './lib/tmdb';
import DetailModal from './components/DetailModal';
import Footer from './components/Footer';
import { useRegion } from './hooks/useRegion';
import './App.css';

export default function App() {
  const [userId, setUserId] = useState(localStorage.getItem('user_id'));
  const [username, setUsername] = useState(localStorage.getItem('username'));
  const [view, setView] = useState('home'); // 'home' or 'profile'
  const [selectedMovieData, setSelectedMovieData] = useState(null);

  const { region, setRegion } = useRegion();
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
      <div className="app-header-nav">
        <div className="app-header-nav-left">
          <button className={`nav-btn ${view === 'home' ? 'active' : 'inactive'}`} onClick={() => setView('home')}>Home</button>
          <button className={`nav-btn ${view === 'profile' ? 'active' : 'inactive'}`} onClick={() => setView('profile')}>Profile</button>
        </div>
        <div className="app-header-nav-right">
          <span><span className="greeting-text">Logged in as: </span><strong style={{ color: '#fff' }}>{username}</strong></span>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
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
        <DetailModal data={selectedMovieData} onClose={() => setSelectedMovieData(null)} region={region} />
      )}

      <Footer />
    </div>
  );
}
