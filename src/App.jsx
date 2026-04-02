import React, { useState } from 'react';
import { useGameState } from './engine/gameState';
import CharacterCreation from './components/CharacterCreation';
import EventModal from './components/EventModal';
import MainGame from './components/MainGame';
import DeathScreen from './components/DeathScreen';
import SplashScreen from './components/SplashScreen';

function App() {
  const engine = useGameState();
  const [splashDismissed, setSplashDismissed] = useState(
    () => !!sessionStorage.getItem('simlyfe_splash')
  );

  const handleSplashDismiss = () => {
    sessionStorage.setItem('simlyfe_splash', '1');
    setSplashDismissed(true);
  };

  if (!engine.character && !engine.isDead) {
    if (!splashDismissed) {
      return <SplashScreen onEnter={handleSplashDismiss} />;
    }
    return <CharacterCreation onStartLife={engine.startLife} />;
  }

  if (engine.isDead) {
    return <DeathScreen engine={engine} />;
  }

  return (
    <>
      <MainGame engine={engine} />
      {engine.currentEvent && (
        <EventModal event={engine.currentEvent} onChoice={engine.handleChoice} />
      )}
    </>
  );
}

export default App;
