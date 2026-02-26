import { useState, useEffect } from 'react';
import AuthPage from './views/AuthPage';
import UsernameSetup from './views/UsernameSetup';
import HomeView from './views/HomeView';
import ProfileView from './views/ProfileView';
import { useSavedMovies } from './hooks/useSavedMovies';
import { getDetails, getTVFullDetails } from './lib/tmdb';
import DetailModal from './components/DetailModal';
import Footer from './components/Footer';
import { useRegion } from './hooks/useRegion';
import { useAuth } from './context/AuthProvider';
import { supabase } from './lib/supabaseClient';
import './App.css';

export default function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [username, setUsername] = useState(null);
  const [fetchingProfile, setFetchingProfile] = useState(true);
  const [view, setView] = useState('home'); // 'home' or 'profile'
  const [selectedMovieData, setSelectedMovieData] = useState(null);

  const { region } = useRegion();
  const { savedMovies, handleSaveMovie, wishlistDetails, fetchWishlistDetails } = useSavedMovies(user?.id);

  useEffect(() => {
    async function fetchProfile() {
      if (user) {
        setFetchingProfile(true);
        const { data } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single();

        if (data && data.username) {
          setUsername(data.username);
        } else {
          setUsername(null);
        }
        setFetchingProfile(false);
      } else {
        setUsername(null);
        setFetchingProfile(false);
      }
    }

    if (!authLoading) {
      fetchProfile();
    }
  }, [user, authLoading]);

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

  async function handleLogout() {
    await signOut();
    window.location.reload();
  }

  if (authLoading || fetchingProfile) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', color: 'white' }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (user && !username) {
    return <UsernameSetup onComplete={({ username }) => setUsername(username)} />;
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
