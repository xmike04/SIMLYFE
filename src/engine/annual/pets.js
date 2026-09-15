import { PET_CATALOG } from '../../config/petCatalog';

/** Charge care and grant companionship for pets alive at the start of the year. */
export function advancePetsYear(pets, { randomFn = Math.random, catalog = PET_CATALOG } = {}) {
  let petHappinessBonus = 0;
  let petMaintenanceCost = 0;
  const petDeathMessages = [];

  const petUpdates = pets.map(pet => {
    if (!pet.isAlive) return pet;
    const petDef = catalog[pet.speciesId];
    if (!petDef) return pet;

    const newAge = pet.age + 1;
    petMaintenanceCost += petDef.annualMaintenanceCost;
    petHappinessBonus += petDef.happinessBonus;

    const deathChance = newAge >= petDef.lifespanMax ? 1.0
      : newAge >= petDef.lifespanMin
        ? (newAge - petDef.lifespanMin) / (petDef.lifespanMax - petDef.lifespanMin) * 0.3
        : 0;

    if (randomFn() < deathChance) {
      petDeathMessages.push(`Your ${petDef.species} ${pet.name} passed away at age ${newAge}. You'll miss them dearly.`);
      return { ...pet, age: newAge, isAlive: false };
    }
    return { ...pet, age: newAge };
  });


  return { pets: petUpdates, maintenanceCost: petMaintenanceCost, happinessBonus: petHappinessBonus, deathMessages: petDeathMessages };
}
