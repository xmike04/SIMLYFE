import React, { useState } from 'react';
import { useGameState } from './engine/gameState';
import CharacterCreation from './components/CharacterCreation';
import EventModal from './components/EventModal';
import MainGame from './components/MainGame';
import DeathScreen from './components/DeathScreen';
import SplashScreen from './components/SplashScreen';
import CloudLoadScreen from './components/game/CloudLoadScreen';

function App() {
  const engine = useGameState();
  const [splashDismissed, setSplashDismissed] = useState(
    () => !!sessionStorage.getItem('simlyfe_splash')
  );

  const [lifeWasVisible, setLifeWasVisible] = useState(false);
  if ((engine.character || engine.isDead) && !lifeWasVisible) {
    setLifeWasVisible(true);
  }

  const handleSplashDismiss = () => {
    sessionStorage.setItem('simlyfe_splash', '1');
    setSplashDismissed(true);
  };

  if (!engine.character && !engine.isDead && !splashDismissed && !lifeWasVisible) {
    return <SplashScreen onEnter={handleSplashDismiss} />;
  }

  if (['loading', 'failed'].includes(engine.cloudLoadState?.status)) {
    return <CloudLoadScreen engine={engine} />;
  }

  if (!engine.character && !engine.isDead) {
    return <CharacterCreation onStartLife={engine.startLife} />;
  }

  if (engine.isDead) {
    return <DeathScreen engine={engine} />;
  }

  return (
    <>
      <MainGame engine={engine} />
      {engine.currentEvent && (
        <EventModal event={engine.currentEvent} onChoice={engine.handleChoice} saveFeedback={engine.lastContinuitySave} />
      )}
    </>
  );
}

export default App;
