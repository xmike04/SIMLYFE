import React from 'react';
import AssetsSheet from '../sheets/AssetsSheet';
import RelationshipsSheet from '../sheets/RelationshipsSheet';
import JobSheet from '../sheets/JobSheet';
import DoctorSheet from '../sheets/DoctorSheet';
import LotterySheet from '../sheets/LotterySheet';
import CasinoSheet from '../sheets/CasinoSheet';
import DatingSheet from '../sheets/DatingSheet';
import WillsSheet from '../sheets/WillsSheet';
import PetsSheet from '../sheets/PetsSheet';
import AccountSheet from '../sheets/AccountSheet';

import ActivitiesSheet from '../sheets/ActivitiesSheet';
import DebugSheet from '../sheets/DebugSheet';

export default function GameSheets({
  engine, visibleSheet, activityMenu, setActivityMenu,
  setActiveSheet, closeSheet, handleSpecialSkill, enableDevTools,
}) {
  const {
    age, bank, stats, career, careersData,
    chooseCareer, relationships, modifyRelationship, modifyProperty, performGig,
    startStartup, enlistMilitary, hireViaHeadhunter, playLottery, goGamble,
    visitDoctor, addRelationship, proposeMarriage, breakUp, haveChild,
    giftRelationship, meetFriend, triggerActivityEvent, belongings, properties,
    buyAsset, sellAsset, buyInvestment, sellInvestment, debugModifyBank,
    studyHard, careerMeta, networking, economyCycle, education,
    checkCareerEligibility, enrollInDegree, attendNetworkingEvent, pets, visitVet,
    will, draftWill, authAccount, signInWithGoogle, signInWithEmail,
    resetPassword, signOutAccount, requestAccountDeletion,
  } = engine;
  return (
    <>
      {/* Action Sheets */}
      {visibleSheet === 'job' && (
        <JobSheet
          age={age}
          bank={bank}
          stats={stats}
          career={career}
          careersData={careersData}
          careerMeta={careerMeta}
          networking={networking}
          education={education}
          chooseCareer={chooseCareer}
          studyHard={studyHard}
          triggerActivityEvent={triggerActivityEvent}
          performGig={performGig}
          attendNetworkingEvent={attendNetworkingEvent}
          enrollInDegree={enrollInDegree}
          checkCareerEligibility={checkCareerEligibility}
          debugModifyBank={debugModifyBank}
          startStartup={startStartup}
          enlistMilitary={enlistMilitary}
          hireViaHeadhunter={hireViaHeadhunter}
          onClose={closeSheet}
        />
      )}

      {visibleSheet === 'activities' && (
        <ActivitiesSheet
          engine={engine}
          activityMenu={activityMenu}
          setActivityMenu={setActivityMenu}
          setActiveSheet={setActiveSheet}
          closeSheet={closeSheet}
          handleSpecialSkill={handleSpecialSkill}
        />
      )}

      {/* ── Doctor sheet ── */}
      {visibleSheet === 'doctor' && (
        <DoctorSheet bank={bank} visitDoctor={visitDoctor} onClose={closeSheet} />
      )}

      {/* ── Lottery sheet ── */}
      {visibleSheet === 'lottery' && (
        <LotterySheet bank={bank} playLottery={playLottery} onClose={closeSheet} />
      )}

      {/* ── Casino sheet ── */}
      {visibleSheet === 'casino' && (
        <CasinoSheet bank={bank} goGamble={goGamble} onClose={closeSheet} />
      )}

      {enableDevTools && visibleSheet === 'debug' && (
        <DebugSheet engine={engine} closeSheet={closeSheet} />
      )}

      {visibleSheet === 'assets' && (
        <AssetsSheet
          bank={bank}
          properties={properties}
          belongings={belongings}
          career={career}
          economyCycle={economyCycle}
          buyAsset={buyAsset}
          sellAsset={sellAsset}
          buyInvestment={buyInvestment}
          sellInvestment={sellInvestment}
          modifyProperty={modifyProperty}
          triggerActivityEvent={triggerActivityEvent}
          debugModifyBank={debugModifyBank}
          onClose={() => setActiveSheet(null)}
        />
      )}

      {visibleSheet === 'relationships' && (
        <RelationshipsSheet
          bank={bank}
          age={age}
          relationships={relationships}
          modifyRelationship={modifyRelationship}
          giftRelationship={giftRelationship}
          proposeMarriage={proposeMarriage}
          breakUp={breakUp}
          haveChild={haveChild}
          meetFriend={meetFriend}
          triggerActivityEvent={triggerActivityEvent}
          debugModifyBank={debugModifyBank}
          onClose={closeSheet}
          onNavigateDating={() => setActiveSheet('dating')}
        />
      )}


      {visibleSheet === 'dating' && (
        <DatingSheet
          bank={bank}
          stats={stats}
          debugModifyBank={debugModifyBank}
          addRelationship={addRelationship}
          triggerActivityEvent={triggerActivityEvent}
          onClose={closeSheet}
        />
      )}

      {visibleSheet === 'account' && (
        <AccountSheet
          authAccount={authAccount}
          signInWithGoogle={signInWithGoogle}
          signInWithEmail={signInWithEmail}
          resetPassword={resetPassword}
          signOutAccount={signOutAccount}
          requestAccountDeletion={requestAccountDeletion}
          onClose={closeSheet}
        />
      )}

      {visibleSheet === 'wills' && (
        <WillsSheet
          relationships={relationships}
          will={will}
          draftWill={draftWill}
          triggerActivityEvent={triggerActivityEvent}
          onClose={closeSheet}
        />
      )}

      {visibleSheet === 'pets' && (
        <PetsSheet
          pets={pets}
          visitVet={visitVet}
          bank={bank}
          onClose={closeSheet}
        />
      )}
    </>
  );
}
