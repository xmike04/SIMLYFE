import React from 'react';
import { useGameState } from './engine/gameState';
import CharacterCreation from './components/CharacterCreation';
import EventModal from './components/EventModal';
import MainGame from './components/MainGame';
import DeathScreen from './components/DeathScreen';

function App() {
  const engine = useGameState();

  if (!engine.character) {
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
